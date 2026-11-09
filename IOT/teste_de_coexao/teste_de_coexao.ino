// ===== SENSORES KY-037 =====
// D4 = Sensor 5 metros
// D3 = Sensor 4 metros
// D2 = Sensor 3 metros 

// PINOS
const int sensor5m = 4;
const int sensor4m = 3;
const int sensor3m = 2;

// CONTADORES
unsigned long cont5m = 0;
unsigned long cont4m = 0;
unsigned long cont3m = 0;

// ESTADOS ANTERIORES
int anterior5m;
int anterior4m;
int anterior3m;

// LOW = deteccao
const int ATIVO = LOW;

void setup() {
  Serial.begin(115200);

  pinMode(sensor5m, INPUT);
  pinMode(sensor4m, INPUT);
  pinMode(sensor3m, INPUT);

  anterior5m = digitalRead(sensor5m);
  anterior4m = digitalRead(sensor4m);
  anterior3m = digitalRead(sensor3m);

  Serial.println("================================");
  Serial.println("   TESTE DOS 3 SENSORES KY-037");
  Serial.println("================================");
  Serial.println("D4 = 5 metros");
  Serial.println("D2 = 4 metros");
  Serial.println("D0 = 3 metros");
  Serial.println("Aguardando impactos...");
}

void loop() {

  int leitura5m = digitalRead(sensor5m);
  unsigned long tempo5m = micros();

  int leitura4m = digitalRead(sensor4m);
  unsigned long tempo4m = micros();

  int leitura3m = digitalRead(sensor3m);
  unsigned long tempo3m = micros();

  if (leitura5m == ATIVO && anterior5m != ATIVO) {
    cont5m++;

    Serial.print("SENSOR 5m | DETECTOU | Tempo: ");
    Serial.print(tempo5m);
    Serial.print(" us | Total: ");
    Serial.println(cont5m);
  }

  if (leitura4m == ATIVO && anterior4m != ATIVO) {
    cont4m++;

    Serial.print("SENSOR 4m | DETECTOU | Tempo: ");
    Serial.print(tempo4m);
    Serial.print(" us | Total: ");
    Serial.println(cont4m);
  }

  if (leitura3m == ATIVO && anterior3m != ATIVO) {
    cont3m++;

    Serial.print("SENSOR 3m | DETECTOU | Tempo: ");
    Serial.print(tempo3m);
    Serial.print(" us | Total: ");
    Serial.println(cont3m);
  }

  anterior5m = leitura5m;
  anterior4m = leitura4m;
  anterior3m = leitura3m;
}