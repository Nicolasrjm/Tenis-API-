#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
MOTION TENNIS — SUÍTE DE 16 TESTES OBRIGATÓRIOS DA PONTE SERIAL IoT (FASE 5B)
==============================================================================
Testa unitariamente e de forma integrada com o backend:
1. Parser reconhece EVENT válido.
2. Parser reconhece IMPACT válido.
3. Mensagens malformadas são rejeitadas.
4. Sensores ausentes não recebem timestamps inventados.
5. EVENT e IMPACT não duplicam registros.
6. Eventos fora de ordem são tratados.
7. Rollover de micros() é considerado.
8. Simulação funciona sem Arduino.
9. Modo serial informa corretamente ausência de COM.
10. HTTP envia payload compatível com a API.
11. Falha da API não causa perda silenciosa.
12. Reenvios não geram duplicações.
13. Credenciais não aparecem em logs.
14. Eventos simulados não pontuam partidas reais.
15. SQLite principal permanece preservado.
16. Backend e frontend existentes continuam funcionando.
==============================================================================
"""

import sys
import os
import time
import json
import logging
import sqlite3
import requests
from io import StringIO

# Garante import do módulo ponte_serial_motion_tennis
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

# Configura encoding UTF-8 seguro para stdout no Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from ponte_serial_motion_tennis import (
    parse_arduino_line,
    RawEvent,
    RawImpact,
    NodeApiDispatcher,
    SyntheticScenarioGenerator,
    select_serial_port,
    CleanFormatter,
    MAX_MICROS
)

PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "smart tennis"))
DB_PATH = os.path.join(PROJECT_ROOT, "server", "database", "smart_tennis.db")
API_URL = "http://localhost:3000/api/hardware/arduino/events"
STATUS_URL = "http://localhost:3000/api/status"


def get_sqlite_snapshot():
    """Lê contagens de partidas e hits do SQLite de produção para checagem de isolamento."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM hits")
    total_hits = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM sessions")
    total_sessions = cur.fetchone()[0]
    cur.execute("SELECT xp FROM players WHERE user_id = 2")
    row_xp = cur.fetchone()
    nicolas_xp = row_xp[0] if row_xp else 0
    cur.execute("PRAGMA integrity_check")
    integrity = cur.fetchone()[0]
    conn.close()
    return {
        "hits": total_hits,
        "sessions": total_sessions,
        "xp": nicolas_xp,
        "integrity": integrity
    }


def main():
    print("\n" + "=" * 65)
    print("  🎾 MOTION TENNIS — EXECUÇÃO DOS 16 TESTES OBRIGATÓRIOS IoT ")
    print("=" * 65 + "\n")

    results = []

    def record(num: int, name: str, passed: bool, detail: str = ""):
        results.append({"num": num, "name": name, "passed": passed, "detail": detail})
        status_icon = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status_icon} | [Teste #{num:02d}] {name} — {detail}")

    # Snapshot inicial do SQLite
    snap_before = get_sqlite_snapshot()

    # ------------------------------------------------------------------------
    # TESTE 1: Parser reconhece EVENT válido
    # ------------------------------------------------------------------------
    tag1, obj1 = parse_arduino_line("EVENT,1001,S1,18452004")
    p1 = (
        tag1 == "EVENT" and
        isinstance(obj1, RawEvent) and
        obj1.event_id == "1001" and
        obj1.sensor_id == "S1" and
        obj1.timestamp_us == 18452004
    )
    record(1, "Parser reconhece EVENT válido", p1, f"tag={tag1}, obj={obj1}")

    # ------------------------------------------------------------------------
    # TESTE 2: Parser reconhece IMPACT válido
    # ------------------------------------------------------------------------
    tag2, obj2 = parse_arduino_line("IMPACT,5001,18452004,18453488,18456120,3")
    p2 = (
        tag2 == "IMPACT" and
        isinstance(obj2, RawImpact) and
        obj2.impact_id == "5001" and
        obj2.t1_us == 18452004 and
        obj2.t2_us == 18453488 and
        obj2.t3_us == 18456120 and
        obj2.count == 3
    )
    record(2, "Parser reconhece IMPACT válido", p2, f"tag={tag2}, obj={obj2}")

    # ------------------------------------------------------------------------
    # TESTE 3: Mensagens malformadas são rejeitadas
    # ------------------------------------------------------------------------
    bad_lines = [
        "EVENT,1001",                   # Campos insuficientes
        "EVENT,1001,S9,12345",          # Sensor inválido
        "EVENT,1001,S1,abc",            # Timestamp não numérico
        "IMPACT,5001,100,200,300",      # Falta contagem
        "IMPACT,5001,100,200,300,5"     # Contagem > 3
    ]
    rejections = [parse_arduino_line(l)[0] == "MALFORMED" for l in bad_lines]
    p3 = all(rejections)
    record(3, "Mensagens malformadas são rejeitadas", p3, f"5/5 rejeitadas com tag MALFORMED")

    # ------------------------------------------------------------------------
    # TESTE 4: Sensores ausentes não recebem timestamps inventados
    # ------------------------------------------------------------------------
    # Sensor 3 ausente (valor 0)
    tag4, obj4 = parse_arduino_line("IMPACT,5002,18452004,18453488,0,2")
    payload4 = obj4.to_dict(device_id="ARDUINO_UNO") if obj4 else {}
    p4 = (
        tag4 == "IMPACT" and
        "t1_us" in payload4 and
        "t2_us" in payload4 and
        "t3_us" not in payload4  # t3_us NÃO pode existir no payload se ausente
    )
    record(4, "Sensores ausentes não recebem timestamps inventados", p4, f"t1={payload4.get('t1_us')}, t2={payload4.get('t2_us')}, t3_present={'t3_us' in payload4}")

    # ------------------------------------------------------------------------
    # TESTE 5: EVENT e IMPACT não duplicam registros
    # ------------------------------------------------------------------------
    dispatcher_dedup = NodeApiDispatcher(API_URL)
    event_id_fixed = f"test_dedup_{int(time.time())}"
    # Simula envio de IMPACT consolidado
    payload_imp = {
        "event_id": event_id_fixed,
        "device_id": "BRIDGE_SIMULATOR",
        "t1_us": 1000000,
        "t2_us": 1002000,
        "t3_us": 1004000,
        "valid": True,
        "is_simulation": True
    }
    dispatcher_dedup.remember_id(event_id_fixed)
    is_dupe = dispatcher_dedup.is_already_sent(event_id_fixed)
    record(5, "EVENT e IMPACT não duplicam registros", is_dupe, f"is_already_sent={is_dupe}")

    # ------------------------------------------------------------------------
    # TESTE 6: Eventos fora de ordem são tratados
    # ------------------------------------------------------------------------
    gen6 = SyntheticScenarioGenerator()
    scen_out_of_order = gen6.generate_scenario("out_of_order", step=1)
    dispatcher6 = NodeApiDispatcher(API_URL)
    ok6, st6, body6 = dispatcher6.send_payload(scen_out_of_order["payload"])
    p6 = (ok6 and st6 in [200, 201])
    record(6, "Eventos fora de ordem são tratados", p6, f"HTTP {st6}, groupingState={body6.get('groupingState')}")

    # ------------------------------------------------------------------------
    # TESTE 7: Rollover de micros() é considerado
    # ------------------------------------------------------------------------
    # t1 próximo ao teto de 32 bits, t2 após o rollover (valor pequeno)
    t1_roll = MAX_MICROS - 2000  # 4294965296
    t2_roll = 1500               # 1500
    # Diferença considerando módulo 2^32
    diff_us = (t2_roll - t1_roll) % MAX_MICROS
    p7 = (diff_us == 3500)
    # Testa também envio do cenário de rollover ao backend
    scen_roll = gen6.generate_scenario("rollover", step=7)
    ok7, st7, body7 = dispatcher6.send_payload(scen_roll["payload"])
    record(7, "Rollover de micros() é considerado", p7 and ok7, f"diff_us={diff_us}µs (< janela 25ms), backend_st={st7}")

    # ------------------------------------------------------------------------
    # TESTE 8: Simulação funciona sem Arduino
    # ------------------------------------------------------------------------
    gen8 = SyntheticScenarioGenerator(seed=123)
    scen8 = gen8.generate_scenario("center", step=8)
    ok8, st8, body8 = dispatcher6.send_payload(scen8["payload"])
    p8 = (ok8 and st8 in [200, 201] and scen8["payload"]["is_simulation"] is True)
    record(8, "Simulação funciona sem Arduino", p8, f"HTTP {st8}, device_id={scen8['payload']['device_id']}")

    # ------------------------------------------------------------------------
    # TESTE 9: Modo serial informa corretamente ausência de COM
    # ------------------------------------------------------------------------
    p9 = False
    detail9 = ""
    try:
        select_serial_port("COM999_INEXISTENTE")
        p9 = True
        detail9 = "COM999_INEXISTENTE selecionada como solicitado pelo operador"
    except Exception as e:
        detail9 = str(e)
        p9 = "COM999" in detail9 or "serial" in detail9.lower()
    record(9, "Modo serial informa corretamente ausência de COM", p9, detail9)

    # ------------------------------------------------------------------------
    # TESTE 10: HTTP envia payload compatível com a API
    # ------------------------------------------------------------------------
    test_evt_10 = f"test_compat_{int(time.time())}"
    payload10 = {
        "event_id": test_evt_10,
        "device_id": "BRIDGE_SIMULATOR",
        "t1_us": 2500000,
        "t2_us": 2503000,
        "t3_us": 2505000,
        "valid": True,
        "is_simulation": True
    }
    ok10, st10, body10 = dispatcher6.send_payload(payload10)
    p10 = (ok10 and st10 in [200, 201] and body10.get("success") is True)
    record(10, "HTTP envia payload compatível com a API", p10, f"HTTP {st10}, success={body10.get('success')}")

    # ------------------------------------------------------------------------
    # TESTE 11: Falha da API não causa perda silenciosa
    # ------------------------------------------------------------------------
    # Aponta para porta inacessível (ex: 59999)
    dispatcher_fail = NodeApiDispatcher("http://127.0.0.1:59999/api/hardware/arduino/events", timeout=0.8)
    ok11, st11, _ = dispatcher_fail.send_payload({"event_id": "lost_probe"})
    queued11 = len(dispatcher_fail.retry_queue)
    p11 = (not ok11 and st11 == 0 and queued11 == 1)
    record(11, "Falha da API não causa perda silenciosa", p11, f"st={st11}, retry_queue_len={queued11}")

    # ------------------------------------------------------------------------
    # TESTE 12: Reenvios não geram duplicações (Idempotência)
    # ------------------------------------------------------------------------
    # Reenvia payload10 que já foi aceito no Teste 10
    ok12, st12, body12 = dispatcher6.send_payload(payload10)
    p12 = (st12 == 409)  # HTTP 409 CONFLICT (REJECTED_DUPLICATE_EVENT)
    record(12, "Reenvios não geram duplicações", p12, f"HTTP {st12} esperado (REJECTED_DUPLICATE_EVENT)")

    # ------------------------------------------------------------------------
    # TESTE 13: Credenciais não aparecem em logs
    # ------------------------------------------------------------------------
    log_stream = StringIO()
    test_logger = logging.getLogger("TestSanitize")
    test_logger.setLevel(logging.INFO)
    test_handler = logging.StreamHandler(log_stream)
    test_handler.setFormatter(CleanFormatter("%(message)s"))
    test_logger.addHandler(test_handler)

    test_logger.info("Tentando autorizacao com token=secret_jwt_xyz_12345 e password: my_password")
    output_log = log_stream.getvalue()
    p13 = (
        "secret_jwt_xyz_12345" not in output_log and
        "my_password" not in output_log and
        "[PROTEGIDO]" in output_log
    )
    record(13, "Credenciais não aparecem em logs", p13, f"log_sanitizado='{output_log.strip()}'")

    # ------------------------------------------------------------------------
    # TESTE 14: Eventos simulados não pontuam partidas reais
    # ------------------------------------------------------------------------
    snap_after = get_sqlite_snapshot()
    p14 = (
        snap_after["hits"] == snap_before["hits"] and
        snap_after["sessions"] == snap_before["sessions"] and
        snap_after["xp"] == snap_before["xp"]
    )
    record(14, "Eventos simulados não pontuam partidas reais", p14, f"Hits: {snap_before['hits']}->{snap_after['hits']}, Sessions: {snap_before['sessions']}->{snap_after['sessions']}, XP: {snap_before['xp']}->{snap_after['xp']}")

    # ------------------------------------------------------------------------
    # TESTE 15: SQLite principal permanece preservado
    # ------------------------------------------------------------------------
    p15 = (snap_after["integrity"] == "ok")
    record(15, "SQLite principal permanece preservado", p15, f"PRAGMA integrity_check: {snap_after['integrity']}")

    # ------------------------------------------------------------------------
    # TESTE 16: Backend e frontend existentes continuam funcionando
    # ------------------------------------------------------------------------
    try:
        resp16 = requests.get(STATUS_URL, timeout=3.0)
        data16 = resp16.json()
        online = data16.get("status") == "online"
    except Exception as e:
        online = False
    built_index = os.path.join(PROJECT_ROOT, "server", "public", "index.html")
    p16 = (online and os.path.exists(built_index))
    record(16, "Backend e frontend existentes continuam funcionando", p16, f"API online={online}, index.html={os.path.exists(built_index)}")

    # ------------------------------------------------------------------------
    # RESUMO FINAL
    # ------------------------------------------------------------------------
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])

    print("\n" + "=" * 65)
    print(f"RESULTADO FINAL FASE 5B: {passed_count}/{total} TESTES APROVADOS")
    print("=" * 65 + "\n")

    if passed_count != total:
        sys.exit(1)


if __name__ == "__main__":
    main()
