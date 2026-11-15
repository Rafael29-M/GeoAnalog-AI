# GeoAnalog AI 🪐🛰️
### Digital Twin Matrix & Planetary Analog Intelligence Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg?style=flat&logo=three.js&logoColor=white)](https://threejs.org)
[![ESP32](https://img.shields.io/badge/ESP32-Bluetooth%20SPP-E7352C.svg?style=flat&logo=espressif&logoColor=white)](https://espressif.com)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

**GeoAnalog AI** es una plataforma integral de exploración y comparación geológica interplanetaria con gemelo digital en tiempo real y teleoperación de rover físico (**Wall - E**) mediante microcontrolador ESP32 con Bluetooth.

---

## 🌟 Características Principales

### 1. 🪐 Cartografía y Exploración Planetaria 3D
- Visualización interactiva en WebGL/Three.js de la **Tierra**, la **Luna** y **Marte**.
- Modelos de elevación digital (DEM) auténticos de misiones espaciales de la NASA:
  - **Luna:** LOLA (Lunar Orbiter Laser Altimeter - LRO).
  - **Marte:** MOLA (Mars Orbiter Laser Altimeter - Mars Global Surveyor).
  - **Tierra:** NASADEM (SRTM reprocess - Atacama y Cráter Barringer de Arizona).
- Inspección topográfica en tiempo real: perfiles de elevación, gradiente de pendiente, rugosidad geodésica e índice de transitabilidad de terreno.

### 2. 🔬 Comparador de Análogos Planetarios
- Algoritmo de similitud vectorial y emparejamiento geológico entre biomas terrestres y terrenos extraterrestres.
- Gráficos de radar comparativos multidimensionales (Pendiente, Desnivel, Rugosidad, Similitud Coseno).
- Generación y exportación de **Certificados de Análisis de Análogo Planetario** en PDF/impresión.

### 3. 🤖 Telemetría y Teleoperación de Wall - E (Rover Físico ESP32)
- Enlace Bluetooth SPP bidireccional mediante **Web Serial API** sin controladores propietarios requeridos.
- **Instrumentación a Bordo:**
  - **DHT11:** Monitoreo térmico e higrométrico ambiental (°C y % HR).
  - **HC-SR04:** Sonar ultrasónico con cálculo de distancia frontal milimétrica y zona de seguridad.
- **Control de Tracción y Cinemática:**
  - Teleoperación manual mediante cruceta D-Pad interactiva en pantalla y soporte nativo para teclado (`W`, `A`, `S`, `D` y `Espacio` para frenar).
  - **Frenado Autónomo de Emergencia:** Algoritmo en firmware que detiene los motores al detectar obstáculos a menos de 25 cm.
- **Terminal de Flujo Serie en Vivo:** Monitor para depuración en tiempo real de cadenas JSON/CSV transmitidas por el rover.
- **Modo Gemelo Digital:** Simulador cinemático y de terreno para pruebas sin necesidad de hardware conectado.

---

## 🛠️ Arquitectura del Sistema

```text
GeoAnalog-AI/
├── backend/
│   ├── app/                    # API REST FastAPI, modelos y lógica científica
│   │   ├── api/routes/         # Endpoints: cuerpos, regiones, métricas y análogos
│   │   ├── services/           # Procesamiento de rasters, GeoTIFF y cálculo de rugosidad
│   │   └── repositories/       # Catálogo de datos y resultados
│   ├── data/
│   │   └── processed/          # Rasters procesados y métricas precalculadas
│   ├── firmware/
│   │   └── ESP32_Rover_Bluetooth.ino # Firmware completo para ESP32 (sensores + motores L298N)
│   ├── manifests/              # Metadatos de datasets y regiones
│   └── tests/                  # Suite de 53 pruebas automáticas con pytest
├── frontend/
│   ├── src/
│   │   ├── components/         # Visores 3D Three.js, HUD de Wall-E, radar y modales
│   │   ├── pages/              # Selector de planetas, comparador y telemetría de rover
│   │   └── utils/
│   │       └── serialManager.js # Gestor singleton no bloqueante de Web Serial
│   └── public/maps/            # Texturas planetarias de alta resolución
└── start_all.bat               # Script para iniciar backend y frontend simultáneamente
```

---

## 🚀 Inicio Rápido

### Prerrequisitos
- **Node.js** v18+ y npm
- **Python** 3.11+ (Recomendado 3.13)
- Navegador moderno con soporte para WebGL y Web Serial (Google Chrome, Microsoft Edge, Opera, Brave).

### Ejecución en un solo paso (Windows)
Simplemente haz doble clic en `start_all.bat` o ejecútalo desde tu terminal:
```cmd
start_all.bat
```

### Ejecución Manual

#### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# En Windows:
.venv\Scripts\activate
# En Linux/macOS:
source .venv/bin/activate

pip install -r requirements.lock.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Documentación OpenAPI / Swagger: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Acceso a la aplicación: [http://localhost:5173](http://localhost:5173)

---

## 🔌 Conexión con el Rover Wall - E (ESP32)

1. Abre el archivo `backend/firmware/ESP32_Rover_Bluetooth.ino` en el Arduino IDE.
2. Instala la biblioteca `DHT sensor library` de Adafruit.
3. Conecta el ESP32 por USB y sube el firmware.
4. **Diagrama de Pines:**
   - **DHT11:** Pin de datos a `GPIO 4`.
   - **HC-SR04:** `TRIG` a `GPIO 5`, `ECHO` a `GPIO 18`.
   - **L298N (Motores):** `IN1` -> `GPIO 26`, `IN2` -> `GPIO 27`, `IN3` -> `GPIO 14`, `IN4` -> `GPIO 12`.
5. En Windows, ve a **Configuración > Bluetooth y dispositivos > Agregar dispositivo** y empareja con `Wall-E-ESP32` (código PIN por defecto: `1234`).
6. En la plataforma web de **GeoAnalog AI**, ve a la pestaña **Rover** y haz clic en **Conectar ESP32**. Selecciona el puerto serie asignado y ¡listo!

---

## 🧪 Pruebas Automatizadas

El backend incluye una suite completa de pruebas científicas y de integración:
```bash
cd backend
pytest -v
```
*Total: 53 pruebas aprobadas.*

---

## 📄 Licencia y Créditos
- Desarrollado como parte del proyecto **GeoAnalog AI**.
- Datos topográficos cortesía de la **NASA PDS Geosciences Node** y **USGS / Earthdata**.
