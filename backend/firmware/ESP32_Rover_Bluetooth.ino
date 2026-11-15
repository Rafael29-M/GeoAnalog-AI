/*
 * =========================================================================
 * GeoAnalog AI - Firmware ESP32 para WALL-E / Telemetría y Manejo Bluetooth
 * =========================================================================
 * 
 * Hardware instalado en WALL-E:
 * 1. Sensor DHT11: Temperatura (°C) y Humedad Relativa (%)
 *    - VCC  -> ESP32 3.3V (o 5V según placa)
 *    - DATA -> ESP32 GPIO 4
 *    - GND  -> ESP32 GND
 * 
 * 2. Sensor Ultrasónico HC-SR04: Proximidad frontal y detección de obstáculos
 *    - VCC  -> ESP32 5V (VIN)
 *    - TRIG -> ESP32 GPIO 5 (Salida de pulso)
 *    - ECHO -> ESP32 GPIO 18 (Retorno eco)
 *    - GND  -> ESP32 GND
 * 
 * 3. Controlador de Motores (Puente H L298N / TB6612FNG):
 *    - IN1  -> ESP32 GPIO 26 (Motor Izq Adelante)
 *    - IN2  -> ESP32 GPIO 27 (Motor Izq Atrás)
 *    - IN3  -> ESP32 GPIO 14 (Motor Der Adelante)
 *    - IN4  -> ESP32 GPIO 12 (Motor Der Atrás)
 *    - GND  -> ESP32 GND Común
 * 
 * Protocolo de Comunicación Bidireccional (Bluetooth SPP):
 * - Nombre de dispositivo Bluetooth: "Wall-E-ESP32"
 * - Envío (ESP32 -> Web): Telemetría JSON 10Hz
 * - Recepción (Web -> ESP32): Comandos 'F' (Adelante), 'B' (Atrás),
 *                            'L' (Giro Izq), 'R' (Giro Der), 'S' (Freno)
 * =========================================================================
 */

#include "BluetoothSerial.h"
#include <DHT.h>

// --- PINES DE SENSORES ---
#define DHTPIN 4           // Pin de datos del DHT11
#define DHTTYPE DHT11      // Tipo de sensor DHT
#define TRIG_PIN 5         // Trigger HC-SR04
#define ECHO_PIN 18        // Echo HC-SR04

// --- PINES DE MOTORES ---
#define MOTOR_IN1 26       // Izquierda adelante
#define MOTOR_IN2 27       // Izquierda atrás
#define MOTOR_IN3 14       // Derecha adelante
#define MOTOR_IN4 12       // Derecha atrás

BluetoothSerial SerialBT;
DHT dht(DHTPIN, DHTTYPE);

// Variables de estado
float currentTemp = 24.0;
float currentHumidity = 45.0;
float currentDistanceCm = 150.0;
String currentCommand = "STOP";
unsigned long lastSensorRead = 0;
unsigned long lastDhtRead = 0;
unsigned long startTime = 0;

// Medición ultrasónica de distancia (cm)
float readUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 400.0;
  
  float distance = (duration * 0.0343) / 2.0;
  if (distance < 2.0) distance = 2.0;
  if (distance > 400.0) distance = 400.0;
  return distance;
}

// Control del Puente H de Motores
void stopMotors() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
  currentCommand = "STOP";
}

void moveForward() {
  // Seguridad autónoma: si hay obstáculo a menos de 25 cm, bloquear avance
  if (currentDistanceCm < 25.0) {
    stopMotors();
    currentCommand = "OBSTACLE_BRAKE";
    return;
  }
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, HIGH);
  digitalWrite(MOTOR_IN4, LOW);
  currentCommand = "FORWARD";
}

void moveBackward() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, HIGH);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, HIGH);
  currentCommand = "BACKWARD";
}

void turnLeft() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, HIGH);
  digitalWrite(MOTOR_IN3, HIGH);
  digitalWrite(MOTOR_IN4, LOW);
  currentCommand = "LEFT";
}

void turnRight() {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, HIGH);
  currentCommand = "RIGHT";
}

void setup() {
  Serial.begin(115200);
  
  // Pines de ultrasonido
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  
  // Pines de motores
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);
  stopMotors();
  
  // Sensor DHT11
  dht.begin();
  
  // Bluetooth SPP
  SerialBT.begin("Wall-E-ESP32");
  startTime = millis();
  
  Serial.println("\n=======================================================");
  Serial.println("  GeoAnalog AI - WALL-E Control Bidireccional Activo");
  Serial.println("  Dispositivo BT: 'Wall-E-ESP32'");
  Serial.println("  Sensores: DHT11 (GPIO 4) + HC-SR04 (TRIG 5, ECHO 18)");
  Serial.println("  Motores: IN1(26), IN2(27), IN3(14), IN4(12)");
  Serial.println("=======================================================\n");
}

void loop() {
  unsigned long now = millis();
  
  // 1. Recepción de comandos de teleoperación por Bluetooth
  if (SerialBT.available()) {
    char cmd = SerialBT.read();
    if (cmd == 'F' || cmd == 'f') {
      moveForward();
    } else if (cmd == 'B' || cmd == 'b') {
      moveBackward();
    } else if (cmd == 'L' || cmd == 'l') {
      turnLeft();
    } else if (cmd == 'R' || cmd == 'r') {
      turnRight();
    } else if (cmd == 'S' || cmd == 's') {
      stopMotors();
    }
  }
  
  // 2. Lectura periódica de DHT11 cada 1.5 s
  if (now - lastDhtRead >= 1500) {
    lastDhtRead = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) currentTemp = t;
    if (!isnan(h)) currentHumidity = h;
  }
  
  // 3. Lectura de Sonar y Transmisión de telemetría a 10 Hz (cada 100 ms)
  if (now - lastSensorRead >= 100) {
    lastSensorRead = now;
    currentDistanceCm = readUltrasonicDistance();
    
    // Freno autónomo si avanza hacia un obstáculo
    if (currentDistanceCm < 25.0 && currentCommand == "FORWARD") {
      stopMotors();
      currentCommand = "OBSTACLE_BRAKE";
    }
    
    String alertStatus = "CLEAR";
    if (currentDistanceCm < 25.0) {
      alertStatus = "CRITICAL_BRAKE";
    } else if (currentDistanceCm < 55.0) {
      alertStatus = "WARNING_PROXIMITY";
    }
    
    float speedVal = 0.0;
    if (currentCommand == "FORWARD") speedVal = 0.22;
    else if (currentCommand == "BACKWARD") speedVal = -0.15;
    else if (currentCommand == "LEFT" || currentCommand == "RIGHT") speedVal = 0.08;
    
    unsigned long uptimeSeconds = (now - startTime) / 1000;
    
    // Trama JSON de telemetría
    String json = "{";
    json += "\"source\":\"HARDWARE_ESP32\",";
    json += "\"device\":\"Wall-E-ESP32\",";
    json += "\"temperature\":" + String(currentTemp, 1) + ",";
    json += "\"humidity\":" + String(currentHumidity, 1) + ",";
    json += "\"distance_cm\":" + String(currentDistanceCm, 1) + ",";
    json += "\"obstacle_alert\":\"" + alertStatus + "\",";
    json += "\"command\":\"" + currentCommand + "\",";
    json += "\"speed\":" + String(speedVal, 2) + ",";
    json += "\"battery\":92.5,";
    json += "\"uptime_s\":" + String(uptimeSeconds);
    json += "}";
    
    SerialBT.println(json);
    Serial.println(json);
  }
}
