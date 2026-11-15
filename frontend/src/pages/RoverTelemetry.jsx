import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Radio, BatteryCharging, Gauge, AlertTriangle, 
  CheckCircle2, Compass, Cpu, Terminal, Eye, Play, Pause, 
  RotateCcw, Bluetooth, ShieldAlert, Waves, Thermometer, Droplets,
  Code2, Copy, Check, Navigation, Power
} from 'lucide-react';
import { fetchRegionMetrics } from '../api/client';
import ESP32Modal from '../components/ESP32Modal';
import serialManager from '../utils/serialManager';

export default function RoverTelemetry({ 
  regionId = 'marte-olympus', 
  onBack, 
  regions = [] 
}) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulationRunning, setSimulationRunning] = useState(true);
  const [roverSpeed, setRoverSpeed] = useState(0.0); // m/s
  const [batteryLevel, setBatteryLevel] = useState(94);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [rawPackets, setRawPackets] = useState([]);
  const [consoleTab, setConsoleTab] = useState('raw_stream'); // 'logs' | 'raw_stream'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isEsp32ModalOpen, setIsEsp32ModalOpen] = useState(false);
  const [telemetrySource, setTelemetrySource] = useState('SIM_PYTHON_TWIN');
  const [serialWriter, setSerialWriter] = useState(null);

  // Estado de Manejo / Teleoperación
  const [drivingDirection, setDrivingDirection] = useState('STOP'); // 'STOP' | 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'OBSTACLE_BRAKE'

  // Sensores físicos: DHT11 y HC-SR04
  const [sensorData, setSensorData] = useState({
    temperature: 24.2,
    humidity: 48.0,
    distance_cm: 125.0,
    obstacle_alert: 'CLEAR',
    command: 'STOP',
    device: 'Wall-E-ESP32',
    uptime_s: 0
  });

  const serialWriterRef = useRef(null);
  serialWriterRef.current = serialWriter;

  const currentRegion = regions.find(
    (r) => (r.region?.id === regionId) || (r.id === regionId)
  )?.region || { id: regionId, name: regionId, body: 'mars' };

  const isMoon = currentRegion.body === 'moon';
  const signalDelay = isMoon ? '1.28 s (Tierra-Luna)' : '14m 22s (Tierra-Marte)';

  // Enviar comando por Web Serial Bluetooth hacia el ESP32
  const sendSerialCommand = async (cmdLetter) => {
    try {
      await serialManager.sendCommand(cmdLetter);
    } catch (e) {
      console.warn('Error enviando orden por Bluetooth Serial:', e);
    }
  };

  // Suscripción permanente al stream de datos de serialManager
  useEffect(() => {
    if (serialManager.isOpen()) {
      setTelemetrySource('HARDWARE_ESP32');
    }

    const unsubscribe = serialManager.subscribe((data, raw) => {
      handleTelemetryUpdate(data, raw);
    });

    return unsubscribe;
  }, []);

  // Manejo de Teleoperación (Teclas o Clics en D-Pad)
  const handleDrive = (dir) => {
    // Si intenta avanzar pero hay obstáculo crítico a menos de 25 cm -> Freno de seguridad
    if (dir === 'FORWARD' && sensorData.distance_cm < 25.0) {
      setDrivingDirection('OBSTACLE_BRAKE');
      setRoverSpeed(0.0);
      sendSerialCommand('S');
      return;
    }

    setDrivingDirection(dir);

    // Mapeo de comandos estándar hacia ESP32
    const cmdMap = {
      FORWARD: 'F',
      BACKWARD: 'B',
      LEFT: 'L',
      RIGHT: 'R',
      STOP: 'S',
      OBSTACLE_BRAKE: 'S'
    };

    sendSerialCommand(cmdMap[dir] || 'S');

    // Actualización de velocidad cinemática
    if (dir === 'FORWARD') setRoverSpeed(0.22);
    else if (dir === 'BACKWARD') setRoverSpeed(-0.15);
    else if (dir === 'LEFT' || dir === 'RIGHT') setRoverSpeed(0.08);
    else setRoverSpeed(0.0);
  };

  // Captura de eventos de teclado (W, A, S, D, Flechas, Espacio)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.repeat) return; // Evitar ráfagas repetidas por mantener pulsado

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleDrive('FORWARD');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        handleDrive('BACKWARD');
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        handleDrive('LEFT');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleDrive('RIGHT');
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleDrive('STOP');
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'].includes(e.code)) {
        handleDrive('STOP');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sensorData.distance_cm]);

  // Cargar métricas científicas reales
  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        const data = await fetchRegionMetrics(regionId);
        setMetrics(data);

        // Mensaje inicial de telemetría
        const initialLog = `[DSN LINK ESTABLISHED] Conexión con Wall - E en ${currentRegion.name}. Inclinación de terreno detectada: ${data.slope.mean.toFixed(2)}°.`;
        setTelemetryLogs([initialLog]);
      } catch (err) {
        console.error('Error cargando métricas para rover:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, [regionId]);

  // Bucle de telemetría a 10 Hz (Generación de paquetes crudos JSON y simulación viva)
  useEffect(() => {
    if (!simulationRunning) return;

    const interval = setInterval(() => {
      // 1. Oscilación suave de batería
      setBatteryLevel((prev) => Math.max(20, Math.min(100, prev + (Math.random() * 0.1 - 0.05))));

      // 2. Simulación de sensores si no hay hardware físico conectado
      if (telemetrySource !== 'HARDWARE_ESP32') {
        setSensorData((prev) => {
          const tDelta = (Math.random() - 0.5) * 0.3;
          const hDelta = (Math.random() - 0.5) * 0.5;

          // Si Wall-E avanza, la distancia al obstáculo frontal disminuye dinámicamente
          let distChange = (Math.random() - 0.5) * 2;
          if (drivingDirection === 'FORWARD') distChange = -4.5;
          else if (drivingDirection === 'BACKWARD') distChange = 3.5;

          const newTemp = Math.max(18.0, Math.min(32.0, Number((prev.temperature + tDelta).toFixed(1))));
          const newHum = Math.max(35.0, Math.min(65.0, Number((prev.humidity + hDelta).toFixed(1))));
          const newDist = Math.max(16.0, Math.min(260.0, Number((prev.distance_cm + distChange).toFixed(1))));

          // Freno automático si se acerca a menos de 25 cm avanzando
          let newDirection = drivingDirection;
          let newAlert = 'CLEAR';
          if (newDist < 25.0) {
            newAlert = 'CRITICAL_BRAKE';
            if (drivingDirection === 'FORWARD') {
              newDirection = 'OBSTACLE_BRAKE';
              setDrivingDirection('OBSTACLE_BRAKE');
              setRoverSpeed(0.0);
            }
          } else if (newDist < 55.0) {
            newAlert = 'WARNING_PROXIMITY';
          }

          const packet = {
            source: 'SIM_DIGITAL_TWIN',
            device: 'Wall-E-ESP32',
            temperature: newTemp,
            humidity: newHum,
            distance_cm: newDist,
            obstacle_alert: newAlert,
            command: newDirection,
            speed: drivingDirection === 'FORWARD' ? 0.22 : drivingDirection === 'BACKWARD' ? -0.15 : drivingDirection === 'STOP' ? 0.0 : 0.08,
            battery: 92.5,
            uptime_s: prev.uptime_s + 1
          };

          const rawJsonString = JSON.stringify(packet);
          const timeStampStr = new Date().toISOString().split('T')[1].replace('Z', '');

          setRawPackets((prevPackets) => [
            { id: Math.random().toString(), time: timeStampStr, raw: rawJsonString },
            ...prevPackets.slice(0, 24)
          ]);

          return {
            ...prev,
            temperature: newTemp,
            humidity: newHum,
            distance_cm: newDist,
            obstacle_alert: newAlert,
            command: newDirection,
            uptime_s: prev.uptime_s + 1
          };
        });
      }

      // 3. Generación de eventos de bitácora
      if (Math.random() < 0.25) {
        const sampleEvents = [
          `HC-SR04 Sonar: Eco a ${sensorData.distance_cm.toFixed(0)} cm. Haz ultrasónico activo.`,
          `DHT11 Clima: Temp ${sensorData.temperature.toFixed(1)}°C | Humedad ${sensorData.humidity.toFixed(0)}% HR.`,
          `Puente H: Modo ${drivingDirection} aplicado a tren de rodaje de 6 ruedas.`,
          `Bluetooth SPP: Paquete 10Hz emitido hacia consola de mando.`
        ];
        const nextLog = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
        setTelemetryLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] ${nextLog}`,
          ...prev.slice(0, 10),
        ]);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [simulationRunning, telemetrySource, drivingDirection, sensorData.distance_cm, sensorData.temperature, sensorData.humidity]);

  // Handler de actualización desde ESP32 físico
  const handleTelemetryUpdate = (data, rawString) => {
    setSensorData((prev) => {
      const updated = { ...prev, source: 'HARDWARE_ESP32' };
      if (data.temperature !== undefined && !isNaN(data.temperature)) updated.temperature = data.temperature;
      if (data.humidity !== undefined && !isNaN(data.humidity)) updated.humidity = data.humidity;
      if (data.distance_cm !== undefined && !isNaN(data.distance_cm)) updated.distance_cm = data.distance_cm;
      if (data.obstacle_alert) updated.obstacle_alert = data.obstacle_alert;
      if (data.command) updated.command = data.command;
      if (data.device) updated.device = data.device;
      return updated;
    });
    setTelemetrySource('HARDWARE_ESP32');
    if (data.command) setDrivingDirection(data.command);
    if (data.speed !== undefined) setRoverSpeed(data.speed);
    if (data.battery !== undefined) setBatteryLevel(data.battery);

    if (rawString) {
      const timeStampStr = new Date().toISOString().split('T')[1].replace('Z', '');
      setRawPackets((prevPackets) => [
        { id: Math.random().toString(), time: timeStampStr, raw: rawString },
        ...prevPackets.slice(0, 35)
      ]);
    }
  };

  const handleCopyRaw = () => {
    if (rawPackets.length > 0) {
      navigator.clipboard.writeText(rawPackets[0].raw);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  // Evaluación de seguridad de tránsito y colisión
  const slopeDeg = metrics?.slope?.mean || 2.0;
  const roughnessM = metrics?.roughness?.mean || 50;
  const isObstacleClose = sensorData.distance_cm < 25.0;
  const isObstacleWarning = sensorData.distance_cm >= 25.0 && sensorData.distance_cm < 55.0;

  let transitStatus = {
    status: isObstacleClose ? 'FRENO ACTIVO' : 'NOMINAL',
    badge: isObstacleClose ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800',
    dot: isObstacleClose ? 'bg-rose-500' : 'bg-emerald-500',
    title: isObstacleClose ? 'Obstáculo Inmediato — Freno de Emergencia Sonar' : 'Terreno Transitable — Avance Seguro',
    desc: isObstacleClose 
      ? `El sensor ultrasónico HC-SR04 detectó un obstáculo a ${sensorData.distance_cm.toFixed(0)} cm. Avance bloqueado para evitar colisión.`
      : 'Pendiente dentro del rango seguro para el tren de rodaje de 6 ruedas (< 6°). Consumo de energía normal.',
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col bg-space-950 text-slate-100 font-sans">
      {/* Barra de cabecera de la consola de control */}
      <header className="px-6 py-3.5 border-b border-space-800 bg-space-900/90 backdrop-blur flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs tabular-nums text-slate-400 hover:text-slate-100 hover:bg-space-800 transition-colors border border-space-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la Región
          </button>
          <div className="h-4 w-px bg-space-800" />
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${telemetrySource === 'HARDWARE_ESP32' ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-emerald-500'}`} />
            <h1 className="text-sm font-semibold tabular-nums text-slate-100">
              Wall - E Explorer <span className="text-slate-400 text-xs">| Telemetría Activa & Teleoperación</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs tabular-nums">
          {/* Botón de Conexión Bluetooth ESP32 */}
          <button
            onClick={() => setIsEsp32ModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
              telemetrySource === 'HARDWARE_ESP32'
                ? 'bg-cyan-950/70 text-cyan-300 border-cyan-700 hover:bg-cyan-900'
                : 'bg-space-850 text-slate-300 border-space-700 hover:bg-space-800'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
            <span>{telemetrySource === 'HARDWARE_ESP32' ? 'Wall - E Bluetooth Conectado' : 'Conectar Wall - E (Bluetooth)'}</span>
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-space-850 border border-space-800 text-slate-300">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            <span>Retardo DSN: {signalDelay}</span>
          </div>

          <button
            onClick={() => setSimulationRunning(!simulationRunning)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border tabular-nums transition-colors ${
              simulationRunning
                ? 'bg-space-800 text-slate-300 border-space-700 hover:bg-space-700'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}
          >
            {simulationRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pausar Enlace
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Reanudar
              </>
            )}
          </button>
        </div>
      </header>

      {/* Contenido Principal: Cabina de Mando */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel Izquierdo: Visualizador del Vehículo y Semáforo de Tránsito (8 Columnas) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Semáforo de Tránsito y Evaluación de Seguridad */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5">
            <div className="flex items-center justify-between border-b border-space-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-slate-400" />
                <h2 className="text-xs tabular-nums text-slate-200">
                  Evaluador de Transitabilidad & Proximidad de Obstáculos
                </h2>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-xs tabular-nums border ${transitStatus.badge}`}>
                {transitStatus.status}
              </span>
            </div>

            <div className="flex items-start gap-4">
              <span className={`w-3.5 h-3.5 rounded-full mt-1 shrink-0 ${transitStatus.dot}`} />
              <div>
                <h3 className="text-base font-semibold text-slate-100">{transitStatus.title}</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {transitStatus.desc}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs tabular-nums text-slate-400">
                  <span>Pendiente Local: <strong className="text-white">{slopeDeg.toFixed(2)}°</strong></span>
                  <span>•</span>
                  <span>Proximidad Sonar: <strong className={isObstacleClose ? 'text-rose-400 font-bold' : 'text-white'}>{sensorData.distance_cm.toFixed(0)} cm</strong></span>
                  <span>•</span>
                  <span>Estado Marcha: <strong className="text-amber-400">{drivingDirection}</strong></span>
                  <span>•</span>
                  <span>Fuente: <strong className="text-cyan-400">{telemetrySource === 'HARDWARE_ESP32' ? 'ESP32 Bluetooth' : 'Simulación'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico Esquemático de Wall-E en Terreno con Rayo Ultrasónico */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-6 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs tabular-nums text-slate-400 mb-4">
              <span>Orientación del Chasis & Sensor Sonar HC-SR04</span>
              <span>Inclinación: {slopeDeg.toFixed(1)}° | Distancia obstáculo: {sensorData.distance_cm.toFixed(0)} cm</span>
            </div>

            {/* Lienzo del Rover en Terreno */}
            <div className="h-72 rounded bg-space-950 border border-space-800 relative flex items-center justify-center overflow-hidden">
              {/* Línea del suelo inclinada según la pendiente real */}
              <div 
                className="absolute w-[140%] h-36 bottom-0 bg-space-850 border-t-2 border-slate-700 transition-transform duration-200"
                style={{
                  transform: `rotate(${-slopeDeg}deg) translateY(40px)`,
                }}
              >
                {/* Textura de rocas en el suelo */}
                <div className="w-full h-full opacity-10 flex justify-around items-center text-xs tabular-nums">
                  <span>• • •</span>
                  <span>▲ ▲</span>
                  <span>• •</span>
                  <span>▲</span>
                  <span>• • •</span>
                </div>
              </div>

              {/* Silueta Estilizada de Wall-E */}
              <div 
                className={`relative z-10 transition-transform duration-200 flex flex-col items-center ${
                  drivingDirection === 'FORWARD' ? 'translate-x-1' : drivingDirection === 'BACKWARD' ? '-translate-x-1' : ''
                }`}
                style={{
                  transform: `rotate(${-slopeDeg}deg)`,
                }}
              >
                {/* Ojos / Mástil binocular icónico de Wall-E */}
                <div className="w-3 h-14 bg-slate-500 rounded-t relative flex flex-col items-center">
                  <div className="absolute -top-4 flex gap-1 bg-transparent">
                    <div className="w-4 h-5 bg-slate-300 rounded-t-sm border border-slate-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
                    </div>
                    <div className="w-4 h-5 bg-slate-300 rounded-t-sm border border-slate-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Cuerpo de Wall-E (Chasis amarillo/ámbar) */}
                <div className="w-36 h-14 bg-amber-950/80 rounded border-2 border-amber-500/80 p-2 flex items-center justify-between text-xs tabular-nums text-slate-300 shadow-lg relative">
                  <div>
                    <div className="font-extrabold text-[12px] text-amber-300 tracking-wider">WALL - E</div>
                    <div className="text-[8px] text-emerald-400 font-mono">
                      {telemetrySource === 'HARDWARE_ESP32' ? 'BT HIL ACTIVO' : 'DIGITAL TWIN'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-100">{roverSpeed.toFixed(2)} m/s</div>
                    <div className="text-[8px] text-slate-400">VELOCIDAD</div>
                  </div>

                  {/* Emisor ultrasónico HC-SR04 en el frente */}
                  <div className="absolute -right-2.5 top-3.5 w-2.5 h-7 bg-amber-400 rounded-r border border-amber-300 flex items-center justify-center shadow-sm" title="Sensor HC-SR04">
                    <Waves className="w-2.5 h-2.5 text-slate-950" />
                  </div>
                </div>

                {/* Tren de Ruedas / Orugas */}
                <div className="w-44 flex justify-between -mt-2">
                  <div className={`w-6 h-6 rounded-full bg-slate-900 border-2 border-amber-500/60 flex items-center justify-center text-[7px] text-slate-300 ${
                    drivingDirection === 'FORWARD' ? 'animate-spin' : drivingDirection === 'BACKWARD' ? 'animate-reverse-spin' : ''
                  }`}>W1</div>
                  <div className={`w-6 h-6 rounded-full bg-slate-900 border-2 border-amber-500/60 flex items-center justify-center text-[7px] text-slate-300 ${
                    drivingDirection === 'FORWARD' ? 'animate-spin' : drivingDirection === 'BACKWARD' ? 'animate-reverse-spin' : ''
                  }`}>W2</div>
                  <div className={`w-6 h-6 rounded-full bg-slate-900 border-2 border-amber-500/60 flex items-center justify-center text-[7px] text-slate-300 ${
                    drivingDirection === 'FORWARD' ? 'animate-spin' : drivingDirection === 'BACKWARD' ? 'animate-reverse-spin' : ''
                  }`}>W3</div>
                </div>
              </div>

              {/* Cono Ultrasónico proyectado desde el HC-SR04 hacia el obstáculo */}
              <div 
                className="absolute z-10 pointer-events-none flex items-center transition-all duration-300"
                style={{
                  left: 'calc(50% + 75px)',
                  transform: `rotate(${-slopeDeg}deg) translateY(-8px)`,
                  width: `${Math.min(240, Math.max(35, sensorData.distance_cm * 1.1))}px`
                }}
              >
                {/* Cono de sonido translúcido */}
                <div className={`h-16 w-full rounded-r-full border-r-2 transition-colors ${
                  isObstacleClose 
                    ? 'bg-rose-500/15 border-rose-400 shadow-[0_0_12px_#f43f5e]' 
                    : isObstacleWarning 
                    ? 'bg-amber-500/15 border-amber-400' 
                    : 'bg-cyan-500/10 border-cyan-400/60'
                } flex items-center justify-end pr-2`}>
                  {/* Obstáculo detectado */}
                  <div className={`w-6 h-9 rounded border flex flex-col items-center justify-center text-[8px] font-bold shadow-md ${
                    isObstacleClose 
                      ? 'bg-rose-900/95 border-rose-400 text-rose-200 animate-pulse' 
                      : 'bg-slate-800 border-slate-600 text-slate-300'
                  }`}>
                    ▲
                  </div>
                </div>
              </div>

              {/* Banner de alerta de colisión si distancia < 25 cm */}
              {isObstacleClose && (
                <div className="absolute top-3 inset-x-6 z-20 bg-rose-950/90 border border-rose-600 px-3.5 py-2 rounded flex items-center justify-between text-xs text-rose-200 animate-pulse">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span><strong>¡FRENO AUTÓNOMO HC-SR04!</strong> Obstáculo detectado a {sensorData.distance_cm.toFixed(0)} cm. Avance bloqueado.</span>
                  </div>
                  <span className="text-[10px] font-mono bg-rose-900 px-2.5 py-0.5 rounded font-bold">EMERGENCY STOP</span>
                </div>
              )}

              {/* Indicador de Línea de Horizonte */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-800 pointer-events-none" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-slate-400">Horizonte 0.0°</div>
            </div>
          </div>

          {/* Consola de Telemetría: Pestañas de Bitácora vs Monitor Serie (JSON Crudo) */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5">
            <div className="flex flex-wrap gap-2 items-center justify-between border-b border-space-800 pb-2.5 mb-3 text-xs tabular-nums">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConsoleTab('raw_stream')}
                  className={`flex items-center gap-1.5 pb-1 border-b-2 text-xs transition-colors ${
                    consoleTab === 'raw_stream' 
                      ? 'border-amber-400 text-amber-300 font-semibold' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Monitor Serie · JSON Crudo de Wall - E</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </button>
                <button
                  onClick={() => setConsoleTab('logs')}
                  className={`flex items-center gap-1.5 pb-1 border-b-2 text-xs transition-colors ${
                    consoleTab === 'logs' 
                      ? 'border-cyan-400 text-cyan-300 font-semibold' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Bitácora de Eventos ROS</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {consoleTab === 'raw_stream' && (
                  <button
                    onClick={handleCopyRaw}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-space-850 hover:bg-space-800 border border-space-700 text-[11px] text-slate-300 transition-colors"
                  >
                    {copiedRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    <span>{copiedRaw ? '¡Copiado!' : 'Copiar JSON'}</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  {telemetrySource === 'HARDWARE_ESP32' ? '10 Hz · Bluetooth SPP (115200 baud)' : '10 Hz · Digital Twin Sim'}
                </span>
              </div>
            </div>

            {/* Contenido Pestaña 1: Trama JSON Cruda */}
            {consoleTab === 'raw_stream' ? (
              <div className="h-36 bg-space-950 rounded border border-space-800 p-3 font-mono text-[11px] text-emerald-400 overflow-y-auto space-y-1">
                {rawPackets.length > 0 ? (
                  rawPackets.map((pkt) => (
                    <div key={pkt.id} className="leading-relaxed hover:bg-white/5 px-1 rounded flex gap-2">
                      <span className="text-slate-500 shrink-0">[{pkt.time}]</span>
                      <span className="text-amber-400 shrink-0">➔</span>
                      <span className="text-slate-200 break-all">{pkt.raw}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">Iniciando flujo de telemetría serie...</div>
                )}
              </div>
            ) : (
              /* Contenido Pestaña 2: Bitácora de Eventos */
              <div className="h-36 bg-space-950 rounded border border-space-800 p-3 tabular-nums text-xs text-slate-300 overflow-y-auto space-y-1.5">
                {telemetryLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed text-[11px]">
                    <span className="text-slate-400">{log.split(']')[0]}]</span>
                    <span className="text-slate-300">{log.split(']')[1]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Manejo Manual, Sensores Físicos y Cinemática (4 Columnas) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tarjeta 1: Cabina de Teleoperación y Manejo Manual de Wall-E */}
          <div className="bg-space-900 border border-amber-600/50 rounded-lg p-5 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between border-b border-space-800 pb-2.5 text-xs tabular-nums">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <Navigation className="w-4 h-4 text-amber-400" />
                <span>Manejo de Wall - E</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                drivingDirection === 'FORWARD' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                drivingDirection === 'BACKWARD' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                drivingDirection === 'LEFT' || drivingDirection === 'RIGHT' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                drivingDirection === 'OBSTACLE_BRAKE' ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse' :
                'bg-space-850 text-slate-400 border-space-700'
              }`}>
                {drivingDirection === 'FORWARD' ? 'AVANZANDO [W]' :
                 drivingDirection === 'BACKWARD' ? 'RETROCEDIENDO [S]' :
                 drivingDirection === 'LEFT' ? 'GIRO IZQ [A]' :
                 drivingDirection === 'RIGHT' ? 'GIRO DER [D]' :
                 drivingDirection === 'OBSTACLE_BRAKE' ? 'BLOQUEO SONAR' : 'STANDBY [STOP]'}
              </span>
            </div>

            {/* D-Pad Virtual de Control */}
            <div className="flex flex-col items-center justify-center gap-1.5 py-1">
              {/* Botón Arriba: Avanzar (W) */}
              <button
                onMouseDown={() => handleDrive('FORWARD')}
                onMouseUp={() => handleDrive('STOP')}
                onTouchStart={() => handleDrive('FORWARD')}
                onTouchEnd={() => handleDrive('STOP')}
                disabled={isObstacleClose}
                className={`w-14 h-11 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
                  drivingDirection === 'FORWARD'
                    ? 'bg-emerald-600 border-emerald-400 text-slate-950 scale-95 shadow-md shadow-emerald-900/40'
                    : isObstacleClose
                    ? 'bg-space-950 border-rose-900/60 text-slate-600 cursor-not-allowed'
                    : 'bg-space-850 border-space-700 text-slate-200 hover:bg-space-750 hover:border-slate-500 active:scale-95'
                }`}
                title="Avanzar (Mantén pulsado W o Flecha Arriba)"
              >
                <span>▲</span>
                <span className="text-[9px] text-slate-400 font-normal">W</span>
              </button>

              {/* Fila Central: Izquierda (A) - Stop (Espacio) - Derecha (D) */}
              <div className="flex items-center gap-1.5">
                <button
                  onMouseDown={() => handleDrive('LEFT')}
                  onMouseUp={() => handleDrive('STOP')}
                  onTouchStart={() => handleDrive('LEFT')}
                  onTouchEnd={() => handleDrive('STOP')}
                  className={`w-14 h-11 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
                    drivingDirection === 'LEFT'
                      ? 'bg-cyan-600 border-cyan-400 text-slate-950 scale-95'
                      : 'bg-space-850 border-space-700 text-slate-200 hover:bg-space-750 hover:border-slate-500 active:scale-95'
                  }`}
                  title="Girar a la Izquierda (Mantén pulsado A o Flecha Izq)"
                >
                  <span>◄</span>
                  <span className="text-[9px] text-slate-400 font-normal">A</span>
                </button>

                <button
                  onClick={() => handleDrive('STOP')}
                  className={`w-14 h-11 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
                    drivingDirection === 'STOP' || drivingDirection === 'OBSTACLE_BRAKE'
                      ? 'bg-rose-950/90 border-rose-700 text-rose-300'
                      : 'bg-space-800 border-space-700 text-slate-300 hover:bg-space-750 active:scale-95'
                  }`}
                  title="Freno de Emergencia / Detener (Espacio)"
                >
                  <span className="text-[10px]">■</span>
                  <span className="text-[8px] text-slate-400 font-normal">STOP</span>
                </button>

                <button
                  onMouseDown={() => handleDrive('RIGHT')}
                  onMouseUp={() => handleDrive('STOP')}
                  onTouchStart={() => handleDrive('RIGHT')}
                  onTouchEnd={() => handleDrive('STOP')}
                  className={`w-14 h-11 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
                    drivingDirection === 'RIGHT'
                      ? 'bg-cyan-600 border-cyan-400 text-slate-950 scale-95'
                      : 'bg-space-850 border-space-700 text-slate-200 hover:bg-space-750 hover:border-slate-500 active:scale-95'
                  }`}
                  title="Girar a la Derecha (Mantén pulsado D o Flecha Der)"
                >
                  <span>►</span>
                  <span className="text-[9px] text-slate-400 font-normal">D</span>
                </button>
              </div>

              {/* Botón Abajo: Retroceder (S) */}
              <button
                onMouseDown={() => handleDrive('BACKWARD')}
                onMouseUp={() => handleDrive('STOP')}
                onTouchStart={() => handleDrive('BACKWARD')}
                onTouchEnd={() => handleDrive('STOP')}
                className={`w-14 h-11 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
                  drivingDirection === 'BACKWARD'
                    ? 'bg-amber-600 border-amber-400 text-slate-950 scale-95'
                    : 'bg-space-850 border-space-700 text-slate-200 hover:bg-space-750 hover:border-slate-500 active:scale-95'
                }`}
                title="Retroceder (Mantén pulsado S o Flecha Abajo)"
              >
                <span>▼</span>
                <span className="text-[9px] text-slate-400 font-normal">S</span>
              </button>
            </div>

            <div className="text-[10px] text-center text-slate-400 font-mono pt-1 border-t border-space-800">
              Control por teclado: <kbd className="px-1.5 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">W</kbd> <kbd className="px-1.5 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">S</kbd> <kbd className="px-1.5 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">D</kbd> o <kbd className="px-1.5 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">Espacio</kbd>
            </div>
          </div>

          {/* Tarjeta 2: Sensores Físicos DHT11 y HC-SR04 */}
          <div className="bg-space-900 border border-cyan-800/60 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-space-800 pb-2.5 text-xs tabular-nums">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                <Bluetooth className="w-4 h-4 text-cyan-400" />
                <span>Sensores Físicos Wall - E (ESP32)</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                telemetrySource === 'HARDWARE_ESP32' 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                  : 'bg-space-800 text-slate-400'
              }`}>
                {telemetrySource === 'HARDWARE_ESP32' ? 'HARDWARE REAL' : 'VIRTUAL'}
              </span>
            </div>

            {/* Sensor 1: DHT11 */}
            <div className="bg-space-950 p-3 rounded border border-space-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                  <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                  Sensor DHT11 · Clima
                </span>
                <span className="text-[10px] font-mono text-slate-400">GPIO 4</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <div className="text-[10px] text-slate-400">Temperatura</div>
                  <div className="text-base font-bold text-slate-100 tabular-nums">
                    {sensorData.temperature.toFixed(1)} <span className="text-xs text-slate-400">°C</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Humedad Relativa</div>
                  <div className="text-base font-bold text-cyan-400 tabular-nums">
                    {sensorData.humidity.toFixed(0)} <span className="text-xs text-slate-400">% HR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sensor 2: HC-SR04 */}
            <div className="bg-space-950 p-3 rounded border border-space-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <Waves className="w-3.5 h-3.5 text-amber-400" />
                  Sensor HC-SR04 · Sonar
                </span>
                <span className="text-[10px] font-mono text-slate-400">TRIG 5 · ECHO 18</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-[10px] text-slate-400">Distancia Frontal</div>
                  <div className="text-xl font-bold text-slate-100 tabular-nums">
                    {sensorData.distance_cm.toFixed(0)} <span className="text-xs text-slate-400">cm</span>
                    <span className="text-xs text-slate-400 ml-2">({(sensorData.distance_cm / 100).toFixed(2)} m)</span>
                  </div>
                </div>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isObstacleClose 
                    ? 'bg-rose-950 text-rose-300 border-rose-800' 
                    : isObstacleWarning 
                    ? 'bg-amber-950 text-amber-300 border-amber-800' 
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}>
                  {isObstacleClose ? 'FRENO STOP' : isObstacleWarning ? 'PRECAUCIÓN' : 'DESPEJADO'}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Cinemática de Tracción */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-space-800 pb-2.5 text-xs tabular-nums">
              <span className="text-slate-300">Cinemática de Tracción</span>
              <Cpu className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 text-xs tabular-nums">
              <div className="flex items-center justify-between bg-space-950 p-2 rounded border border-space-800">
                <span className="text-slate-400">Velocidad de Avance</span>
                <span className={`font-semibold ${roverSpeed !== 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
                  {roverSpeed.toFixed(2)} m/s (~{(Math.abs(roverSpeed) * 3.6).toFixed(1)} km/h)
                </span>
              </div>

              <div className="flex items-center justify-between bg-space-950 p-2 rounded border border-space-800">
                <span className="text-slate-400">Deslizamiento de Rueda (Slip)</span>
                <span className={`font-semibold ${slopeDeg > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(slopeDeg * 1.8).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between bg-space-950 p-2 rounded border border-space-800">
                <span className="text-slate-400">Freno Automático</span>
                <span className={`font-semibold ${isObstacleClose ? 'text-rose-400' : 'text-slate-200'}`}>
                  {isObstacleClose ? 'ACTIVO (STOP HC-SR04)' : slopeDeg > 14 ? 'ACTIVO (PENDIENTE)' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta 4: Gestión de Energía */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-space-800 pb-2.5 text-xs tabular-nums">
              <span className="text-slate-300">Gestión de Energía</span>
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
            </div>

            <div>
              <div className="flex justify-between text-xs tabular-nums mb-1.5">
                <span className="text-slate-400">Batería Principal</span>
                <span className="text-emerald-400 font-bold">{batteryLevel.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-space-950 h-2 rounded overflow-hidden border border-space-800">
                <div 
                  className="bg-emerald-500 h-full transition-colors duration-200"
                  style={{ width: `${batteryLevel}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs tabular-nums">
              <div className="bg-space-950 p-2.5 rounded border border-space-800">
                <div className="text-xs text-slate-400">Fuente Potencia</div>
                <div className="text-slate-200 font-semibold mt-0.5">LiFePO4 24V</div>
              </div>
              <div className="bg-space-950 p-2.5 rounded border border-space-800">
                <div className="text-xs text-slate-400">Voltaje de Bus</div>
                <div className="text-slate-200 font-semibold mt-0.5">24.8 V DC</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Conexión ESP32 */}
      {isEsp32ModalOpen && (
        <ESP32Modal
          onClose={() => setIsEsp32ModalOpen(false)}
          telemetry={{ ...sensorData, source: telemetrySource, command: drivingDirection }}
          onSelectSource={(source) => setTelemetrySource(source)}
          onTelemetryUpdate={handleTelemetryUpdate}
          onSetSerialWriter={(writer) => setSerialWriter(writer)}
        />
      )}
    </div>
  );
}
