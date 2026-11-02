#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
MOTION TENNIS — PONTE DE COMUNICAÇÃO SERIAL / SIMULAÇÃO IoT (PYTHON -> NODE.JS)
==============================================================================
Diretório Oficial: C:\\Users\\nicolas\\Desktop\\Tenis-API-\\IOT
Alvo do Backend:   http://localhost:3000/api/hardware/arduino/events

Dois modos de operação explicitamente separados:
1. MODO SIMULAÇÃO (--mode sim / --sim):
   - Não abre porta COM e não exige Arduino fisicamente conectado.
   - Gera eventos sintéticos determinísticos e reproduzíveis (S1, S2, S3).
   - Testa cenários: 1 sensor, 2 sensores, 3 sensores, duplicatas, fora de ordem,
     rollover de micros(), ruído e resiliência de rede.
   - Totalmente ISOLADO: não pontua partidas reais, não gera XP e não altera dados.

2. MODO SERIAL REAL (--mode serial / --port COMx):
   - Abre a porta COM configurada com baud rate 115200.
   - Lê as linhas emitidas pelo firmware (motion_tennis_sensores.ino):
       EVENT,eventId,sensorId,timestampUs
       IMPACT,impactId,t1,t2,t3,count
   - Reconexão com atraso controlado, validação e deduplicação estrita.
==============================================================================
"""

import sys
import os
import time
import math
import json
import random
import logging
import argparse
import signal
from collections import deque
from typing import Optional, Dict, Any, List, Tuple

# Configura encoding UTF-8 seguro para stdout no Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Dependências externas
try:
    import requests
except ImportError:
    print("[ERRO FATAL] Biblioteca 'requests' não encontrada.")
    print("Instale com: pip install requests")
    sys.exit(1)

try:
    import serial
    from serial.tools import list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False


# ============================================================================
# CONSTANTES E CONFIGURAÇÕES PADRÃO
# ============================================================================
DEFAULT_API_URL = os.environ.get("MOTION_TENNIS_API_URL", "http://localhost:3000/api/hardware/arduino/events")
DEFAULT_BAUD = 115200
DEFAULT_TIMEOUT_HTTP = 3.0
MAX_MICROS = 4294967296  # 2^32 (Rollover do micros() do Arduino @ 32 bits)
MAX_RETRY_QUEUE = 100

# Coordenadas da Parede Padrão (3m x 2m) para cálculo de tempos sintéticos
DEFAULT_WALL_WIDTH_M = 3.0
DEFAULT_WALL_HEIGHT_M = 2.0
DEFAULT_PROPAGATION_SPEED_MPS = 340.0  # m/s no ar


# ============================================================================
# FORMATAÇÃO DE LOGS EM PORTUGUÊS (SEM VAZAMENTO DE TOKENS)
# ============================================================================
class CleanFormatter(logging.Formatter):
    def format(self, record):
        msg = super().format(record)
        # Sanitização de segurança: remove qualquer menção a tokens ou segredos
        for sensitive_key in ["token", "bearer", "authorization", "secret", "password"]:
            if sensitive_key in msg.lower():
                import re
                msg = re.sub(rf'(?i)({sensitive_key}[:=]\s*)[\w\-._]+', r'\1[PROTEGIDO]', msg)
        return msg

logger = logging.getLogger("MotionTennisBridge")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler(sys.stdout)
ch.setFormatter(CleanFormatter("%(asctime)s %(message)s", datefmt="[%H:%M:%S]"))
logger.addHandler(ch)


# ============================================================================
# ESTRUTURAS DE DADOS DO PROTOCOLO IoT
# ============================================================================
class RawEvent:
    def __init__(self, event_id: str, sensor_id: str, timestamp_us: int):
        self.event_id = event_id
        self.sensor_id = sensor_id.upper()
        self.timestamp_us = timestamp_us % MAX_MICROS

    def to_dict(self, device_id: str, is_simulation: bool = False) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "device_id": device_id,
            "sensor_id": self.sensor_id,
            "timestamp_us": self.timestamp_us,
            "valid": True,
            "is_simulation": is_simulation
        }

    def __repr__(self):
        return f"RawEvent(id={self.event_id}, sensor={self.sensor_id}, ts={self.timestamp_us}µs)"


class RawImpact:
    def __init__(self, impact_id: str, t1_us: int, t2_us: int, t3_us: int, count: int):
        self.impact_id = impact_id
        self.t1_us = (t1_us % MAX_MICROS) if t1_us > 0 else 0
        self.t2_us = (t2_us % MAX_MICROS) if t2_us > 0 else 0
        self.t3_us = (t3_us % MAX_MICROS) if t3_us > 0 else 0
        self.count = count

    def to_dict(self, device_id: str, is_simulation: bool = False) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "event_id": f"imp_{self.impact_id}",
            "device_id": device_id,
            "valid": True,
            "is_simulation": is_simulation
        }
        # NÃO fabrica timestamps para sensores ausentes (valor 0 = ausente)
        if self.t1_us > 0:
            payload["t1_us"] = self.t1_us
        if self.t2_us > 0:
            payload["t2_us"] = self.t2_us
        if self.t3_us > 0:
            payload["t3_us"] = self.t3_us
        return payload

    def __repr__(self):
        return f"RawImpact(id={self.impact_id}, t1={self.t1_us}, t2={self.t2_us}, t3={self.t3_us}, count={self.count})"


# ============================================================================
# PARSER E VALIDADOR DO PROTOCOLO DO ARDUINO
# ============================================================================
def parse_arduino_line(line: str) -> Tuple[str, Optional[Any]]:
    """
    Analisa uma linha emitida pelo firmware Arduino (motion_tennis_sensores.ino).
    Retorna (tipo, objeto):
      - ("STATUS", payload_str)
      - ("EVENT", RawEvent)
      - ("IMPACT", RawImpact)
      - ("MALFORMED", erro_str)
      - ("IGNORED", motivo_str)
    """
    if not line:
        return ("IGNORED", "Linha vazia")

    cleaned = line.strip()
    if not cleaned or cleaned.startswith("=") or cleaned.startswith("-") or cleaned.startswith("["):
        return ("IGNORED", "Linha de cabeçalho ou diagnóstico textual")

    parts = [p.strip() for p in cleaned.split(",")]
    tag = parts[0].upper()

    if tag == "STATUS":
        return ("STATUS", cleaned)

    if tag == "EVENT":
        # Formato esperado: EVENT,eventId,sensorId,timestampUs
        if len(parts) != 4:
            return ("MALFORMED", f"EVENT requer 4 campos, recebido {len(parts)}: '{cleaned}'")
        event_id = parts[1]
        raw_sensor = parts[2].upper()
        # Normaliza sensor (S1, S2, S3)
        if raw_sensor in ["S1", "1"]:
            sensor_id = "S1"
        elif raw_sensor in ["S2", "2"]:
            sensor_id = "S2"
        elif raw_sensor in ["S3", "3"]:
            sensor_id = "S3"
        else:
            return ("MALFORMED", f"Identificador de sensor inválido: '{raw_sensor}'")

        try:
            ts_us = int(parts[3])
            if ts_us < 0:
                return ("MALFORMED", f"Timestamp negativo não permitido: {ts_us}")
        except ValueError:
            return ("MALFORMED", f"Timestamp não numérico: '{parts[3]}'")

        return ("EVENT", RawEvent(event_id, sensor_id, ts_us))

    if tag == "IMPACT":
        # Formato esperado: IMPACT,impactId,t1Us,t2Us,t3Us,sensorCount
        if len(parts) < 6:
            return ("MALFORMED", f"IMPACT requer 6 campos, recebido {len(parts)}: '{cleaned}'")
        impact_id = parts[1]
        try:
            t1 = int(parts[2])
            t2 = int(parts[3])
            t3 = int(parts[4])
            count = int(parts[5])
            if count < 1 or count > 3:
                return ("MALFORMED", f"Contagem de sensores inválida: {count}")
        except ValueError:
            return ("MALFORMED", f"Valores numéricos de IMPACT inválidos em: '{cleaned}'")

        return ("IMPACT", RawImpact(impact_id, t1, t2, t3, count))

    return ("IGNORED", f"Linha com tag desconhecida: '{tag}'")


# ============================================================================
# CLIENTE HTTP RESILIENTE COM DEDUPLICAÇÃO E FILA DE RETENTATIVA
# ============================================================================
class NodeApiDispatcher:
    def __init__(self, api_url: str, timeout: float = DEFAULT_TIMEOUT_HTTP, token: Optional[str] = None):
        self.api_url = api_url
        self.timeout = timeout
        self.token = token
        self.session = requests.Session()
        self.retry_queue: deque = deque(maxlen=MAX_RETRY_QUEUE)
        self.sent_event_ids: set = set()
        self.sent_history: deque = deque(maxlen=500)

        # Estatísticas
        self.total_dispatched = 0
        self.total_success = 0
        self.total_duplicate_409 = 0
        self.total_rejected_422 = 0
        self.total_errors = 0
        self.total_response_time_ms = 0.0

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MotionTennis-IoT-Bridge/1.0"
        }
        if self.token:
            headers["X-IoT-Device-Token"] = self.token
        return headers

    def remember_id(self, event_id: str):
        if not event_id:
            return
        self.sent_event_ids.add(event_id)
        self.sent_history.append(event_id)
        if len(self.sent_history) > 500:
            oldest = self.sent_history.popleft()
            self.sent_event_ids.discard(oldest)

    def is_already_sent(self, event_id: str) -> bool:
        return bool(event_id and event_id in self.sent_event_ids)

    def send_payload(self, payload: Dict[str, Any], attempt_retry: bool = True) -> Tuple[bool, int, Dict[str, Any]]:
        """
        Envia payload para POST /api/hardware/arduino/events com tratamento
        de respostas 200, 201, 400, 401, 403, 409, 422 e 500.
        """
        event_id = payload.get("event_id")
        self.total_dispatched += 1

        t0 = time.monotonic()
        try:
            resp = self.session.post(
                self.api_url,
                json=payload,
                headers=self._get_headers(),
                timeout=self.timeout
            )
            elapsed_ms = (time.monotonic() - t0) * 1000.0
            self.total_response_time_ms += elapsed_ms

            status = resp.status_code
            try:
                body = resp.json()
            except Exception:
                body = {"raw": resp.text}

            if status in [200, 201]:
                self.total_success += 1
                if event_id:
                    self.remember_id(event_id)
                return True, status, body

            if status == 409:
                # Duplicado ou já processado pelo backend (idempotência confirmada)
                self.total_duplicate_409 += 1
                if event_id:
                    self.remember_id(event_id)
                return False, status, body

            if status == 422:
                # Backend rejeitou por ser leitura incompleta, ruído ou limiar baixo
                self.total_rejected_422 += 1
                return False, status, body

            if status in [400, 401, 403]:
                # Erro de cliente ou autorização (não retenta na fila para não inundar)
                self.total_errors += 1
                logger.warning(f"[HTTP {status}] Rejeição pelo backend: {body.get('error', 'Acesso negado ou formato inválido')}")
                return False, status, body

            # Erro 5xx do servidor
            self.total_errors += 1
            logger.error(f"[HTTP {status}] Erro interno do servidor Motion Tennis.")
            if attempt_retry:
                self.retry_queue.append(payload)
            return False, status, body

        except requests.exceptions.RequestException as exc:
            elapsed_ms = (time.monotonic() - t0) * 1000.0
            self.total_response_time_ms += elapsed_ms
            self.total_errors += 1
            logger.error(f"[HTTP FALHA] Não foi possível conectar a {self.api_url}: {type(exc).__name__}")
            if attempt_retry:
                self.retry_queue.append(payload)
            return False, 0, {"error": str(exc)}

    def flush_retry_queue(self):
        """Tenta reenviar pacotes represados por falhas transitórias de conexão."""
        if not self.retry_queue:
            return
        count = len(self.retry_queue)
        logger.info(f"[RECONEXÃO] Tentando reenviar {count} pacote(s) da fila de espera...")
        retried = 0
        while self.retry_queue and retried < count:
            item = self.retry_queue.popleft()
            ok, st, _ = self.send_payload(item, attempt_retry=False)
            if not ok and st == 0:
                # Servidor ainda inacessível; recoloca e para
                self.retry_queue.appendleft(item)
                break
            retried += 1


# ============================================================================
# GERADOR DE CENÁRIOS SINTÉTICOS DETERMINÍSTICOS (MODO SIMULAÇÃO)
# ============================================================================
class SyntheticScenarioGenerator:
    """
    Gera timestamps e pacotes sintéticos reproduzíveis baseados na física da parede
    e na geometria oficial dos 3 sensores: S1=(0,H), S2=(W,H), S3=(0,0).
    """
    def __init__(
        self,
        wall_w: float = DEFAULT_WALL_WIDTH_M,
        wall_h: float = DEFAULT_WALL_HEIGHT_M,
        speed_mps: float = DEFAULT_PROPAGATION_SPEED_MPS,
        seed: Optional[int] = None
    ):
        self.wall_w = wall_w
        self.wall_h = wall_h
        self.speed_mps = speed_mps
        self.base_micros = 10_000_000  # Inicia em 10 segundos virtuais
        if seed is not None:
            random.seed(seed)

    def calculate_timestamps_for_point(self, x: float, y: float, base_us: Optional[int] = None) -> Tuple[int, int, int]:
        """Calcula t1, t2, t3 teóricos no ar para um impacto em (x, y)."""
        base = base_us if base_us is not None else self.base_micros
        # S1 = (0, H)
        d1 = math.hypot(x - 0.0, y - self.wall_h)
        # S2 = (W, H)
        d2 = math.hypot(x - self.wall_w, y - self.wall_h)
        # S3 = (0, 0)
        d3 = math.hypot(x - 0.0, y - 0.0)

        t1 = int(base + (d1 / self.speed_mps) * 1_000_000) % MAX_MICROS
        t2 = int(base + (d2 / self.speed_mps) * 1_000_000) % MAX_MICROS
        t3 = int(base + (d3 / self.speed_mps) * 1_000_000) % MAX_MICROS
        return t1, t2, t3

    def generate_scenario(self, scenario_name: str, step: int = 1) -> Dict[str, Any]:
        """
        Produz payload estruturado para o cenário especificado:
          - center: 3 sensores disparando em impacto central
          - top_left: impacto próximo a S1 (S1 dispara bem antes)
          - top_right: impacto próximo a S2
          - bottom_left: impacto próximo a S3
          - incomplete_2: 2 sensores disparam, 1 ausente (sem timestamp inventado)
          - isolated_1: apenas 1 sensor dispara (ruído de bancada / leitura incompleta)
          - duplicate: replay de event_id já transmitido
          - out_of_order: S3 chega antes de S1
          - rollover: timestamps atravessando 2^32 - 1
          - noise_burst: pulsos com intervalo menor que janela refratária
        """
        self.base_micros = (self.base_micros + 500_000) % MAX_MICROS
        event_id = f"sim_{scenario_name}_{step}_{int(time.time())}"

        if scenario_name == "center":
            # Centro da parede (X=1.50m, Y=1.00m)
            t1, t2, t3 = self.calculate_timestamps_for_point(1.50, 1.00)
            return {
                "name": "Centro da Parede (3/3 Sensores)",
                "event_id": event_id,
                "payload": {
                    "event_id": event_id,
                    "device_id": "BRIDGE_SIMULATOR",
                    "t1_us": t1,
                    "t2_us": t2,
                    "t3_us": t3,
                    "valid": True,
                    "is_simulation": True
                },
                "expected": "3. Impacto sintético localizado pelo algoritmo (Simulação)"
            }

        elif scenario_name == "top_left":
            # Perto de S1 (X=0.40m, Y=1.80m)
            t1, t2, t3 = self.calculate_timestamps_for_point(0.40, 1.80)
            return {
                "name": "Canto Superior Esquerdo - Próximo S1",
                "event_id": event_id,
                "payload": {
                    "event_id": event_id,
                    "device_id": "BRIDGE_SIMULATOR",
                    "t1_us": t1,
                    "t2_us": t2,
                    "t3_us": t3,
                    "valid": True,
                    "is_simulation": True
                },
                "expected": "Setor 1 ou 2 localizado com S1 adiantado"
            }

        elif scenario_name == "incomplete_2":
            # S1 e S2 disparam, S3 NÃO responde (sem inventar timestamp para S3!)
            t1, t2, _ = self.calculate_timestamps_for_point(1.20, 1.50)
            return {
                "name": "Leitura Incompleta (2/3 Sensores - S3 ausente)",
                "event_id": event_id,
                "payload": {
                    "event_id": event_id,
                    "device_id": "BRIDGE_SIMULATOR",
                    "t1_us": t1,
                    "t2_us": t2,
                    # t3_us deliberadamente omitido (NÃO FABRICA VALORES)
                    "valid": True,
                    "is_simulation": True
                },
                "expected": "REJECTED_INCOMPLETE_PACKET ou INCOMPLETE (HTTP 422)"
            }

        elif scenario_name == "isolated_1":
            # Apenas S1 dispara isolado (ruído de bancada)
            t1 = self.base_micros
            return {
                "name": "Ruído Isolado (1/3 Sensor - S1 apenas)",
                "event_id": event_id,
                "payload": {
                    "event_id": event_id,
                    "device_id": "BRIDGE_SIMULATOR",
                    "sensor_id": "S1",
                    "timestamp_us": t1,
                    "valid": True,
                    "is_simulation": True,
                    "finalize_pending": True
                },
                "expected": "NOISE_OR_INCOMPLETE / Descartado"
            }

        elif scenario_name == "duplicate":
            # Mesmo event_id da iteração anterior
            dup_id = f"sim_fixed_dup_id_{step // 2}"
            t1, t2, t3 = self.calculate_timestamps_for_point(1.50, 1.00)
            return {
                "name": "Evento Duplicado (Teste de Idempotência)",
                "event_id": dup_id,
                "payload": {
                    "event_id": dup_id,
                    "device_id": "BRIDGE_SIMULATOR",
                    "t1_us": t1,
                    "t2_us": t2,
                    "t3_us": t3,
                    "valid": True,
                    "is_simulation": True
                },
                "expected": "HTTP 409 (REJECTED_DUPLICATE_EVENT)"
            }

        elif scenario_name == "out_of_order":
            # S3 chega em pacote separado com timestamp menor que a referência
            t1, t2, t3 = self.calculate_timestamps_for_point(0.20, 0.30)
            readings = [
                {"event_id": f"{event_id}_S3", "sensor_id": "S3", "timestamp_us": t3, "device_id": "BRIDGE_SIMULATOR", "valid": True, "is_simulation": True},
                {"event_id": f"{event_id}_S1", "sensor_id": "S1", "timestamp_us": t1, "device_id": "BRIDGE_SIMULATOR", "valid": True, "is_simulation": True},
                {"event_id": f"{event_id}_S2", "sensor_id": "S2", "timestamp_us": t2, "device_id": "BRIDGE_SIMULATOR", "valid": True, "is_simulation": True}
            ]
            return {
                "name": "Pacotes Fora de Ordem (S3 antes de S1)",
                "event_id": event_id,
                "payload": {
                    "readings": readings,
                    "finalize_pending": True
                },
                "expected": "Agrupamento temporal backend reordena e aceita"
            }

        elif scenario_name == "rollover":
            # S1 dispara em 4.294.965.000 us (perto do limite de 32 bits);
            # S2 e S3 disparam após o rollover (ex: 2.000 us e 4.500 us)
            t1 = MAX_MICROS - 2296  # 4294965000
            t2 = 1500               # 1500 (após rollover)
            t3 = 3800               # 3800 (após rollover)
            return {
                "name": "Rollover de 32 bits de micros() (4.294.967.295 -> 0)",
                "event_id": event_id,
                "payload": {
                    "event_id": event_id,
                    "device_id": "BRIDGE_SIMULATOR",
                    "t1_us": t1,
                    "t2_us": t2,
                    "t3_us": t3,
                    "valid": True,
                    "is_simulation": True
                },
                "expected": "Diferença com sinal módulo 2^32 calculada sem erro negativo"
            }

        else:
            # Padrão: centro
            t1, t2, t3 = self.calculate_timestamps_for_point(1.50, 1.00)
            return {
                "name": f"Impacto Padrão ({scenario_name})",
                "event_id": event_id,
                "payload": {
                    "event_id": event_id,
                    "device_id": "BRIDGE_SIMULATOR",
                    "t1_us": t1,
                    "t2_us": t2,
                    "t3_us": t3,
                    "valid": True,
                    "is_simulation": True
                },
                "expected": "Sucesso"
            }


# ============================================================================
# EXECUÇÃO DO MODO SIMULAÇÃO
# ============================================================================
def run_simulation_mode(args, dispatcher: NodeApiDispatcher):
    logger.info("==============================================================")
    logger.info("  🎾 MOTION TENNIS — PONTE IoT EM MODO SIMULAÇÃO SINTÉTICA   ")
    logger.info("==============================================================")
    logger.info(f" Destino da API:     {dispatcher.api_url}")
    logger.info(" Isolamento:         ATIVO (device_id='BRIDGE_SIMULATOR', is_simulation=True)")
    logger.info(" Proteção de Jogos:  Zero pontuação em partidas reais e zero XP")
    logger.info(f" Cenário:            {args.scenario}")
    logger.info(f" Quantidade total:   {'Contínua (Ctrl+C para parar)' if args.count == 0 else args.count}")
    logger.info(f" Intervalo:          {args.interval}s")
    logger.info("==============================================================\n")

    generator = SyntheticScenarioGenerator(seed=args.seed)

    scenarios_pool = [
        "center",
        "top_left",
        "incomplete_2",
        "isolated_1",
        "out_of_order",
        "rollover",
        "duplicate"
    ]

    selected_scenarios = scenarios_pool if args.scenario == "all" else [args.scenario]
    step = 0

    try:
        while True:
            step += 1
            scenario_name = selected_scenarios[(step - 1) % len(selected_scenarios)]
            scenario = generator.generate_scenario(scenario_name, step=step)

            logger.info(f"[SIMULAÇÃO #{step}] Executando: {scenario['name']}")
            payload = scenario["payload"]

            ok, status, resp = dispatcher.send_payload(payload)

            if ok:
                diag = resp.get("impact") or resp
                cat_label = diag.get("categoryLabel", "Aceito")
                sector = diag.get("sectorId")
                rms = diag.get("residualRmsM")
                sec_text = f"Setor {sector}" if sector else "Área Neutra / Sem Setor"
                rms_text = f" | Resíduo: {rms}m" if rms is not None else ""
                logger.info(f"  -> HTTP {status} OK | {cat_label} | {sec_text}{rms_text}")
            elif status == 409:
                logger.info(f"  -> HTTP 409 CONFLITO (Idempotência confirmada: evento duplicado rejeitado)")
            elif status == 422:
                logger.info(f"  -> HTTP 422 REJEITADO (Leitura incompleta ou ruído descartado como esperado)")
            else:
                logger.warning(f"  -> HTTP {status} | Resposta: {resp}")

            # Reenvia fila de espera se houver pacotes represados
            dispatcher.flush_retry_queue()

            if args.count > 0 and step >= args.count:
                logger.info("\n[CONCLUÍDO] Quantidade especificada de eventos simulados atingida.")
                break

            time.sleep(args.interval)

    except KeyboardInterrupt:
        logger.info("\n[ENCERRANDO] Simulação interrompida pelo operador.")

    print_final_summary(dispatcher, mode="SIMULAÇÃO SINTÉTICA")


# ============================================================================
# EXECUÇÃO DO MODO SERIAL REAL
# ============================================================================
def select_serial_port(requested_port: Optional[str]) -> str:
    """Detecta portas disponíveis e exige autorização explícita do operador."""
    if not SERIAL_AVAILABLE:
        raise RuntimeError("Módulo 'pyserial' não disponível no ambiente Python.")

    ports = list(list_ports.comports())

    if requested_port:
        # Operador passou porta via flag --port
        clean = requested_port.strip().upper()
        return clean

    # Se não foi fornecida flag, lista portas e solicita seleção
    if not ports:
        raise RuntimeError(
            "Nenhuma porta serial COM encontrada no Windows.\n"
            "Verifique se o cabo USB do Arduino Uno está conectado ou use o modo simulação (--mode sim)."
        )

    logger.info("\nPORTAS SERIAIS DETECTADAS NO WINDOWS:")
    for idx, p in enumerate(ports, 1):
        logger.info(f"  {idx} - {p.device}: {p.description}")

    if len(ports) == 1:
        choice = ports[0].device
        logger.info(f"\nSelecionando automaticamente a única porta disponível: {choice}")
        return choice

    print("\nInforme o número da porta COM desejada (ou Ctrl+C para cancelar): ", end="")
    try:
        val = int(input().strip())
        if 1 <= val <= len(ports):
            return ports[val - 1].device
        raise ValueError("Opção fora do intervalo.")
    except Exception as e:
        raise RuntimeError(f"Seleção de porta serial inválida: {e}")


def run_serial_mode(args, dispatcher: NodeApiDispatcher):
    if not SERIAL_AVAILABLE:
        logger.error("[ERRO FATAL] O pacote 'pyserial' não está instalado.")
        logger.error("Execute: pip install pyserial")
        sys.exit(1)

    port_name = select_serial_port(args.port)
    logger.info("==============================================================")
    logger.info("  🎾 MOTION TENNIS — PONTE IoT EM MODO SERIAL REAL (ARDUINO) ")
    logger.info("==============================================================")
    logger.info(f" Porta Serial:       {port_name}")
    logger.info(f" Baud Rate:          {args.baud}")
    logger.info(f" Destino da API:     {dispatcher.api_url}")
    logger.info(f" Modo Encaminhamento: {args.forward_mode.upper()}")
    logger.info("==============================================================\n")

    ser = None
    backoff = 2.0
    confirmed_connection = False

    try:
        while True:
            # 1. Conexão / Reconexão com atraso controlado
            if ser is None or not ser.is_open:
                try:
                    logger.info(f"[SERIAL] Tentando abrir porta {port_name} a {args.baud} baud...")
                    ser = serial.Serial(port_name, args.baud, timeout=1.0)
                    time.sleep(1.8)  # Aguarda reset do ATmega328P após DTR
                    ser.reset_input_buffer()
                    logger.info(f"[SERIAL] Porta {port_name} aberta. Aguardando pacotes do firmware...")
                    backoff = 2.0
                except (serial.SerialException, OSError) as err:
                    logger.warning(f"[SERIAL FALHA] Não foi possível conectar a {port_name}: {err}")
                    logger.info(f"[SERIAL] Nova tentativa em {backoff:.1f}s...")
                    time.sleep(backoff)
                    backoff = min(backoff * 1.5, 15.0)
                    continue

            # 2. Leitura contínua linha a linha
            try:
                raw_bytes = ser.readline()
                if not raw_bytes:
                    continue  # Timeout de 1s sem dados (sensores em repouso)

                line = raw_bytes.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                tag, parsed = parse_arduino_line(line)

                if tag == "STATUS":
                    if not confirmed_connection:
                        confirmed_connection = True
                        logger.info(f"[CONEXÃO CONFIRMADA] Handshake do Arduino recebido: '{parsed}'")
                    continue

                if tag == "MALFORMED":
                    logger.warning(f"[LINHA MALFORMADA] Descartada: {parsed}")
                    continue

                if tag == "IGNORED":
                    continue

                # 3. Encaminhamento e Deduplicação Inteligente
                if tag == "EVENT":
                    evt: RawEvent = parsed
                    logger.info(f"[EVENTO SENSOR] {evt.sensor_id} disparou em {evt.timestamp_us} µs (ID #{evt.event_id})")

                    if args.forward_mode == "events":
                        # Encaminha leituras individuais; o backend fará o agrupamento
                        payload = evt.to_dict(device_id="ARDUINO_UNO", is_simulation=False)
                        ok, st, body = dispatcher.send_payload(payload)
                        if ok:
                            logger.info(f"  -> Encaminhado EVENT #{evt.event_id} (HTTP {st})")
                    # No modo 'impact' padrão, EVENT apenas é exibido no log e IMPACT consolida

                elif tag == "IMPACT":
                    imp: RawImpact = parsed
                    logger.info(f"[PACOTE IMPACTO] ID #{imp.impact_id} | Contagem: {imp.count}/3 | S1={imp.t1_us} S2={imp.t2_us} S3={imp.t3_us}")

                    if args.forward_mode in ["impact", "both"]:
                        # Encaminha o impacto completo gerado pelo Arduino
                        payload = imp.to_dict(device_id="ARDUINO_UNO", is_simulation=False)
                        ok, st, body = dispatcher.send_payload(payload)
                        if ok:
                            diag = body.get("impact") or body
                            cat_label = diag.get("categoryLabel", "Aceito")
                            sector = diag.get("sectorId")
                            sec_text = f"Setor {sector}" if sector else "Área Neutra / Sem Setor"
                            logger.info(f"  -> HTTP {st} | {cat_label} | {sec_text}")
                        else:
                            logger.warning(f"  -> HTTP {st} | Rejeitado: {body.get('reason', body)}")

                # Reenvia fila de espera se houver pacotes represados
                dispatcher.flush_retry_queue()

            except (serial.SerialException, OSError) as err:
                logger.error(f"[SERIAL ERRO] Conexão com {port_name} perdida: {err}")
                try:
                    if ser:
                        ser.close()
                except Exception:
                    pass
                ser = None
                confirmed_connection = False
                time.sleep(2.0)

    except KeyboardInterrupt:
        logger.info("\n[ENCERRANDO] Encerramento solicitado pelo operador.")
    finally:
        if ser and ser.is_open:
            try:
                ser.close()
                logger.info(f"[SERIAL] Porta {port_name} fechada com segurança.")
            except Exception:
                pass

    print_final_summary(dispatcher, mode=f"SERIAL REAL ({port_name})")


# ============================================================================
# RELATÓRIO FINAL CONSOLIDADO
# ============================================================================
def print_final_summary(dispatcher: NodeApiDispatcher, mode: str):
    avg_resp = (
        (dispatcher.total_response_time_ms / dispatcher.total_dispatched)
        if dispatcher.total_dispatched > 0 else 0.0
    )
    logger.info("\n==============================================================")
    logger.info("   MOTION TENNIS IoT — RELATÓRIO FINAL DA PONTE SERIAL       ")
    logger.info("==============================================================")
    logger.info(f" Modo de operação:              {mode}")
    logger.info(f" Total de payloads disparados:  {dispatcher.total_dispatched}")
    logger.info(f" Sucesso (HTTP 200/201):        {dispatcher.total_success}")
    logger.info(f" Duplicatas evitadas (HTTP 409): {dispatcher.total_duplicate_409}")
    logger.info(f" Rejeições / Incompletos (422): {dispatcher.total_rejected_422}")
    logger.info(f" Falhas / Erros de rede:        {dispatcher.total_errors}")
    logger.info(f" Fila residual não enviada:     {len(dispatcher.retry_queue)}")
    logger.info(f" Tempo médio de resposta:       {avg_resp:.1f} ms")
    logger.info(" Preservação de dados:          Zero alteração em jogos, XP ou SQLite")
    logger.info("==============================================================\n")


# ============================================================================
# PONTO DE ENTRADA PRINCIPAL (CLI)
# ============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Ponte de Comunicação Serial / Simulação IoT para Motion Tennis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:
  # Executar 10 eventos sintéticos com todos os cenários (Modo Simulação padrão):
  python ponte_serial_motion_tennis.py --mode sim --count 10

  # Executar simulação contínua com intervalo de 2 segundos:
  python ponte_serial_motion_tennis.py --sim --interval 2.0 --count 0

  # Simular cenário específico de impacto central:
  python ponte_serial_motion_tennis.py --sim --scenario center --count 5

  # Simular cenário de rollover de micros() (4.294.967.295 -> 0):
  python ponte_serial_motion_tennis.py --sim --scenario rollover --count 3

  # Conectar na porta serial real COM3 a 115200 baud:
  python ponte_serial_motion_tennis.py --mode serial --port COM3
        """
    )

    parser.add_argument(
        "--mode", "-m",
        choices=["sim", "simulation", "serial"],
        default="sim",
        help="Modo de operação: 'sim' (simulação sintética sem Arduino) ou 'serial' (hardware real via COM)"
    )
    parser.add_argument(
        "--sim",
        action="store_true",
        help="Atalho rápido para --mode sim"
    )
    parser.add_argument(
        "--port", "-p",
        type=str,
        default=None,
        help="Nome da porta serial COM (ex: COM3, COM4). Se omitido no modo serial, exibe menu interativo."
    )
    parser.add_argument(
        "--baud", "-b",
        type=int,
        default=DEFAULT_BAUD,
        help=f"Baud rate da porta serial (padrão: {DEFAULT_BAUD})"
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default=DEFAULT_API_URL,
        help=f"URL do endpoint de eventos no backend Node.js (padrão: {DEFAULT_API_URL})"
    )
    parser.add_argument(
        "--forward-mode",
        choices=["impact", "events", "both"],
        default="impact",
        help="Estratégia de envio: 'impact' (envia pacote consolidado IMPACT e evita duplicatas), 'events' (envia EVENT individual) ou 'both'"
    )
    parser.add_argument(
        "--scenario", "-s",
        choices=["all", "center", "top_left", "incomplete_2", "isolated_1", "duplicate", "out_of_order", "rollover"],
        default="all",
        help="Cenário de teste sintético no modo simulação (padrão: all)"
    )
    parser.add_argument(
        "--interval", "-i",
        type=float,
        default=1.5,
        help="Intervalo em segundos entre eventos simulados (padrão: 1.5s)"
    )
    parser.add_argument(
        "--count", "-c",
        type=int,
        default=10,
        help="Quantidade de eventos simulados a gerar (0 = contínuo até Ctrl+C; padrão: 10)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Semente aleatória para garantir simulação determinística e reproduzível"
    )
    parser.add_argument(
        "--token",
        type=str,
        default=None,
        help="Token opcional de serviço local (X-IoT-Device-Token), caso configurado na API"
    )

    args = parser.parse_args()

    mode = "sim" if args.sim else args.mode
    dispatcher = NodeApiDispatcher(api_url=args.api_url, token=args.token)

    if mode in ["sim", "simulation"]:
        run_simulation_mode(args, dispatcher)
    else:
        run_serial_mode(args, dispatcher)


if __name__ == "__main__":
    main()
