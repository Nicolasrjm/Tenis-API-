
import serial
from serial.tools import list_ports
import time
import csv
from datetime import datetime

BAUD = 115200
LIMIAR = 60
INTERVALO_EVENTOS = 0.3

def conectar():
    portas = list(list_ports.comports())

    if not portas:
        raise RuntimeError("Nenhuma porta serial encontrada.")

    print("\nPORTAS DISPONIVEIS:")
    for i, porta in enumerate(portas, 1):
        print(f"{i} - {porta.device}: {porta.description}")

    if len(portas) == 1:
        escolhida = portas[0].device
    else:
        opcao = int(input("Numero da porta Arduino: "))
        escolhida = portas[opcao - 1].device

    return serial.Serial(escolhida, BAUD, timeout=1)


def main():
    print("=" * 58)
    print("MOTION TENNIS | MONITORAMENTO IOT")
    print("Arduino UNO + 3 sensores KY-037")
    print("=" * 58)

    arduino = conectar()

    print("\nConectado! Calibrando sensores...")
    time.sleep(2)
    arduino.reset_input_buffer()

    referencias = [0.0, 0.0, 0.0]
    amostras = 0
    eventos = 0
    ultimo_evento = 0
    ultima_exibicao = 0

    with arduino, open(
        "impactos_sensores.csv", "w",
        newline="", encoding="utf-8"
    ) as arquivo:

        csv_writer = csv.writer(arquivo)
        csv_writer.writerow([
            "data_hora", "tempo_ms",
            "sensor_1", "sensor_2", "sensor_3",
            "delta_1", "delta_2", "delta_3",
            "possivel_impacto", "sensor_destaque"
        ])

        try:
            while True:
                linha = arduino.readline().decode(
                    "utf-8", errors="ignore"
                ).strip()

                partes = linha.split(",")

                if len(partes) != 4:
                    continue

                try:
                    valores = [int(x) for x in partes]
                except ValueError:
                    continue

                tempo_ms = valores[0]
                leituras = valores[1:]

                if not all(0 <= v <= 1023 for v in leituras):
                    continue

                # Calibracao inicial: 50 amostras
                if amostras < 50:
                    for i in range(3):
                        referencias[i] += leituras[i]

                    amostras += 1

                    if amostras == 50:
                        referencias = [
                            valor / 50 for valor in referencias
                        ]
                        print("\nCALIBRACAO CONCLUIDA")
                        print("Referencias:", [
                            round(v, 1) for v in referencias
                        ])
                        print("\nMonitorando impactos...\n")

                    continue

                deltas = [
                    round(abs(leituras[i] - referencias[i]), 1)
                    for i in range(3)
                ]

                maior_delta = max(deltas)
                indice = deltas.index(maior_delta)
                agora = time.monotonic()

                impacto = (
                    maior_delta >= LIMIAR
                    and agora - ultimo_evento >= INTERVALO_EVENTOS
                )

                destaque = indice + 1 if impacto else 0

                if impacto:
                    eventos += 1
                    ultimo_evento = agora

                    print("\n" + "=" * 58)
                    print(f"POSSIVEL IMPACTO #{eventos}")
                    print(f"Tempo Arduino: {tempo_ms} ms")
                    print(f"Leituras: {leituras}")
                    print(f"Referencias: {[round(v, 1) for v in referencias]}")
                    print(f"Variacoes: {deltas}")
                    print(f"Maior resposta: SENSOR {destaque}")
                    print(f"Amplitude da variacao: {maior_delta}")
                    print("Localizacao: NAO CONFIRMADA")
                    print("=" * 58)

                # Atualiza lentamente as referencias
                # apenas quando nao ha variacao elevada
                if maior_delta < LIMIAR:
                    for i in range(3):
                        referencias[i] = (
                            0.995 * referencias[i]
                            + 0.005 * leituras[i]
                        )

                csv_writer.writerow([
                    datetime.now().isoformat(timespec="milliseconds"),
                    tempo_ms,
                    *leituras,
                    *deltas,
                    int(impacto),
                    destaque
                ])

                if agora - ultima_exibicao >= 0.5:
                    ultima_exibicao = agora

                    print(
                        f"[{tempo_ms:>7} ms] "
                        f"S1={leituras[0]:4} "
                        f"S2={leituras[1]:4} "
                        f"S3={leituras[2]:4} | "
                        f"Delta={deltas} | "
                        f"Eventos={eventos}"
                    )
                    arquivo.flush()

        except KeyboardInterrupt:
            print("\nMonitoramento finalizado.")
            print(f"Total de eventos: {eventos}")
            print("Arquivo: impactos_sensores.csv")


if __name__ == "__main__":
    try:
        main()
    except (serial.SerialException, RuntimeError, ValueError,
            IndexError) as erro:
        print(f"\nERRO: {erro}")
        print("Confira a conexao e a porta do Arduino.")
