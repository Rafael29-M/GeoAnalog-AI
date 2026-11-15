import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, BatteryCharging, Gauge, AlertTriangle, 
  CheckCircle2, Compass, Cpu, Terminal, Eye, Play, Pause, 
  RotateCcw, Bluetooth, ShieldAlert, Waves, Thermometer, Droplets,
  Code2, Copy, Check, Navigation, Power, ArrowDown
} from 'lucide-react';
import ESP32Modal from './ESP32Modal';
import serialManager from '../utils/serialManager';

export default function WallECockpit({
  selectedBody = 'MARS',
  regionName = 'Jezero / Olympus',
  slopeDeg = 4.1,
  className = ''
}) {
  const [simulationRunning, setSimulationRunning] = useState(true);
  const [roverSpeed, setRoverSpeed] = useState(0.0); // m/s
  const [batteryLevel, setBatteryLevel] = useState(94);
  const [telemetryLogs, setTelemetryLogs] = useState([
    `[DSN LINK ESTABLISHED] Conexión con Wall - E en ${regionName}. Inclinación de terreno detectada: ${Number(slopeDeg).toFixed(2)}°.`,
    `[INCLINOMETER CALIBRATED] Pitch: ${Number(slopeDeg).toFixed(1)}° | Roll: 0.8°. Suspensión rocker-bogie absorbiendo relieve.`
  ]);
  const [rawPackets, setRawPackets] = useState([
    { id: '1', time: '12:00:01', raw: '{"temp":24.2,"hum":48,"dist":125,"cmd":"STOP"}' },
    { id: '2', time: '12:00:02', raw: '{"temp":24.2,"hum":48,"dist":124,"cmd":"STOP"}' }
  ]);
  const [consoleTab, setConsoleTab] = useState('raw_stream'); // 'logs' | 'raw_stream'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isEsp32ModalOpen, setIsEsp32ModalOpen] = useState(false);
  const [telemetrySource, setTelemetrySource] = useState('SIM_PYTHON_TWIN');

  // Estado de Manejo / Teleoperación
  const [drivingDirection, setDrivingDirection] = useState('STOP'); // 'STOP' | 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'OBSTACLE_BRAKE'

  // Sensores físicos: DHT11 y HC-SR04
  const [sensorData, setSensorData] = useState({
    temperature: 24.2,
    humidity: 48.0,
    distance_cm: 118.0,
    obstacle_alert: 'CLEAR',
    command: 'STOP',
    device: 'Wall-E-ESP32',
    uptime_s: 0
  });

  const isMoon = selectedBody === 'MOON' || selectedBody === 'moon';
  const signalDelay = isMoon ? '1.28 s (Tierra-Luna)' : '14m 22s (Tierra-Marte)';

  // Enviar comando por Web Serial Bluetooth hacia el ESP32
  const sendSerialCommand = async (cmdLetter) => {
    try {
      await serialManager.sendCommand(cmdLetter);
    } catch (e) {
      console.warn('Error enviando orden por Bluetooth Serial:', e);
    }
  };

  // Manejador central de paquetes de telemetría
  const handleTelemetryUpdate = (data, raw) => {
    if (!data) return;

    setSensorData((prev) => ({
      ...prev,
      ...data,
      temperature: data.temperature !== undefined ? Number(data.temperature) : prev.temperature,
      humidity: data.humidity !== undefined ? Number(data.humidity) : prev.humidity,
      distance_cm: data.distance_cm !== undefined ? Number(data.distance_cm) : prev.distance_cm,
      obstacle_alert: data.obstacle_alert || (data.distance_cm < 25 ? 'CRITICAL_BRAKE' : data.distance_cm < 50 ? 'WARNING_PROXIMITY' : 'CLEAR'),
    }));

    if (raw) {
      const timeStr = new Date().toTimeString().split(' ')[0];
      setRawPackets((prev) => [
        { id: Math.random().toString(), time: timeStr, raw: raw },
        ...prev.slice(0, 40)
      ]);
    }
  };

  // Suscripción permanente al stream de datos de serialManager
  useEffect(() => {
    if (serialManager.isOpen()) {
      setTelemetrySource('HARDWARE_ESP32');
    }

    const unsubscribe = serialManager.subscribe((data, raw) => {
      setTelemetrySource('HARDWARE_ESP32');
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
      if (e.repeat) return;

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

  // Simulación dinámica de telemetría de fondo (si no está conectado el hardware real)
  useEffect(() => {
    if (!simulationRunning || telemetrySource === 'HARDWARE_ESP32') return;

    const interval = setInterval(() => {
      setSensorData((prev) => {
        const distDelta = (Math.random() - 0.5) * 6;
        const newDist = Math.max(14, Math.min(210, Number((prev.distance_cm + distDelta).toFixed(1))));
        const newTemp = Number((24.2 + Math.sin(Date.now() * 0.001) * 0.9).toFixed(1));
        const newHum = Math.round(48 + Math.cos(Date.now() * 0.0008) * 3);
        const newAlert = newDist < 25 ? 'CRITICAL_BRAKE' : newDist < 55 ? 'WARNING_PROXIMITY' : 'CLEAR';

        const rawPacketStr = `{"temp":${newTemp},"hum":${newHum},"dist":${newDist.toFixed(0)},"cmd":"${drivingDirection}"}`;
        const timeStr = new Date().toTimeString().split(' ')[0];

        setRawPackets((rawPrev) => [
          { id: Math.random().toString(), time: timeStr, raw: rawPacketStr },
          ...rawPrev.slice(0, 30)
        ]);

        return {
          ...prev,
          temperature: newTemp,
          humidity: newHum,
          distance_cm: newDist,
          obstacle_alert: newAlert
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [simulationRunning, telemetrySource, drivingDirection]);

  const handleCopyRaw = () => {
    if (rawPackets.length > 0) {
      navigator.clipboard.writeText(rawPackets[0].raw);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  // Evaluación de seguridad de tránsito y colisión
  const isObstacleClose = sensorData.distance_cm < 25.0;
  const isObstacleWarning = sensorData.distance_cm >= 25.0 && sensorData.distance_cm < 55.0;

  const transitStatus = {
    status: isObstacleClose ? 'FRENO ACTIVO' : 'NOMINAL',
    badge: isObstacleClose ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800',
    dot: isObstacleClose ? 'bg-rose-500' : 'bg-emerald-500',
    title: isObstacleClose ? 'Obstáculo Inmediato — Freno de Emergencia Sonar' : 'Terreno Transitable — Avance Seguro',
    desc: isObstacleClose 
      ? `El sensor ultrasónico HC-SR04 detectó un obstáculo a ${sensorData.distance_cm.toFixed(0)} cm. Avance bloqueado para evitar colisión.`
      : 'Pendiente dentro del rango seguro para el tren de rodaje de 6 ruedas (< 6°). Consumo de energía normal.',
  };

  return (
    <div id="walle-cockpit" className={`bg-space-950 border-t border-space-800 text-slate-100 font-sans ${className}`}>
      {/* Barra de cabecera de la consola de control de Wall - E */}
      <div className="px-6 py-3 border-b border-space-800 bg-space-900/90 backdrop-blur flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${telemetrySource === 'HARDWARE_ESP32' ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-emerald-500 animate-pulse'}`} />
            <h2 className="text-sm font-bold tracking-wide text-slate-100 flex items-center gap-2">
              <span className="text-amber-400 font-extrabold">WALL - E</span> Explorer
              <span className="text-slate-400 text-xs font-normal">| Telemetría & Teleoperación Activa</span>
            </h2>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-space-850 border border-space-700 text-slate-300">
            {regionName} ({selectedBody})
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs tabular-nums">
          {/* Botón de Conexión Bluetooth ESP32 */}
          <button
            onClick={() => setIsEsp32ModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold transition-all ${
              telemetrySource === 'HARDWARE_ESP32'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.3)] hover:bg-cyan-900'
                : 'bg-space-850 text-slate-200 border-space-700 hover:bg-space-800 hover:border-cyan-500/50'
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
                <span>Pausar Enlace</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Reanudar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contenido Principal: Cuadrícula de Cabina de Mando */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1700px] mx-auto">
        {/* Panel Izquierdo: Visualizador de Orientación y Consola Serie (8 Columnas) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Semáforo de Transitabilidad */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-space-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Evaluador de Transitabilidad & Proximidad de Obstáculos
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${transitStatus.badge}`}>
                {transitStatus.status}
              </span>
            </div>

            <div className="flex items-start gap-3.5">
              <span className={`w-3.5 h-3.5 rounded-full mt-1 shrink-0 ${transitStatus.dot}`} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-100">{transitStatus.title}</div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {transitStatus.desc}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-4 text-xs tabular-nums text-slate-400">
                  <span>Pendiente Local: <strong className="text-white">{Number(slopeDeg).toFixed(2)}°</strong></span>
                  <span>•</span>
                  <span>Proximidad Sonar: <strong className={isObstacleClose ? 'text-rose-400 font-bold' : 'text-white'}>{sensorData.distance_cm.toFixed(0)} cm</strong></span>
                  <span>•</span>
                  <span>Marcha: <strong className="text-amber-400 font-mono font-bold">{drivingDirection}</strong></span>
                  <span>•</span>
                  <span>Fuente: <strong className="text-cyan-400">{telemetrySource === 'HARDWARE_ESP32' ? 'ESP32 Bluetooth SPP' : 'Simulación Gemelo Digital'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico Esquemático 2D de Wall-E en Terreno con Rayo Ultrasónico */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-xs tabular-nums text-slate-400 mb-3">
              <span className="font-semibold text-slate-300">Orientación del Chasis & Sensor Sonar HC-SR04</span>
              <span>Inclinación: {Number(slopeDeg).toFixed(1)}° | Distancia obstáculo: {sensorData.distance_cm.toFixed(0)} cm</span>
            </div>

            {/* Lienzo del Rover en Terreno */}
            <div className="h-64 rounded bg-space-950 border border-space-800 relative flex items-center justify-center overflow-hidden">
              {/* Línea del suelo inclinada según la pendiente real */}
              <div 
                className="absolute w-[140%] h-36 bottom-0 bg-space-850 border-t-2 border-slate-700 transition-transform duration-200"
                style={{
                  transform: `rotate(${-slopeDeg}deg) translateY(40px)`,
                }}
              >
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
                <div className={`h-16 w-full rounded-r-full border-r-2 transition-colors ${
                  isObstacleClose 
                    ? 'bg-rose-500/20 border-rose-400 shadow-[0_0_15px_#f43f5e]' 
                    : isObstacleWarning 
                    ? 'bg-amber-500/15 border-amber-400' 
                    : 'bg-cyan-500/10 border-cyan-400/60'
                } flex items-center justify-end pr-2`}>
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
                <div className="absolute top-3 inset-x-6 z-20 bg-rose-950/95 border border-rose-600 px-3.5 py-2 rounded flex items-center justify-between text-xs text-rose-200 animate-pulse shadow-lg">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span><strong>¡FRENO AUTÓNOMO HC-SR04!</strong> Obstáculo a {sensorData.distance_cm.toFixed(0)} cm. Avance bloqueado.</span>
                  </div>
                  <span className="text-[10px] font-mono bg-rose-900 px-2 py-0.5 rounded font-bold">EMERGENCY STOP</span>
                </div>
              )}

              {/* Línea de Horizonte */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-800 pointer-events-none" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-slate-400">Horizonte 0.0°</div>
            </div>
          </div>

          {/* Consola Serie en Vivo: Monitor JSON vs Bitácora ROS */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-4 shadow-sm">
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
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-space-850 hover:bg-space-800 border border-space-700 text-[11px] text-slate-300 transition-colors"
                  >
                    {copiedRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    <span>{copiedRaw ? '¡Copiado!' : 'Copiar JSON'}</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  {telemetrySource === 'HARDWARE_ESP32' ? '10 Hz · Bluetooth SPP' : '10 Hz · Digital Twin Sim'}
                </span>
              </div>
            </div>

            {/* Contenido Serie */}
            {consoleTab === 'raw_stream' ? (
              <div className="h-32 bg-space-950 rounded border border-space-800 p-2.5 font-mono text-[11px] text-emerald-400 overflow-y-auto space-y-1">
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
              <div className="h-32 bg-space-950 rounded border border-space-800 p-2.5 tabular-nums text-xs text-slate-300 overflow-y-auto space-y-1">
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

        {/* Panel Derecho: Teleoperación (D-Pad), Sensores Físicos, Cinemática y Batería (4 Columnas) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Tarjeta 1: Teleoperación D-Pad de Wall-E */}
          <div className="bg-space-900 border border-amber-600/50 rounded-lg p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-space-800 pb-2 text-xs tabular-nums">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
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
              <button
                onMouseDown={() => handleDrive('FORWARD')}
                onMouseUp={() => handleDrive('STOP')}
                onTouchStart={() => handleDrive('FORWARD')}
                onTouchEnd={() => handleDrive('STOP')}
                disabled={isObstacleClose}
                className={`w-14 h-10 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
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

              <div className="flex items-center gap-1.5">
                <button
                  onMouseDown={() => handleDrive('LEFT')}
                  onMouseUp={() => handleDrive('STOP')}
                  onTouchStart={() => handleDrive('LEFT')}
                  onTouchEnd={() => handleDrive('STOP')}
                  className={`w-14 h-10 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
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
                  className={`w-14 h-10 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
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
                  className={`w-14 h-10 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
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

              <button
                onMouseDown={() => handleDrive('BACKWARD')}
                onMouseUp={() => handleDrive('STOP')}
                onTouchStart={() => handleDrive('BACKWARD')}
                onTouchEnd={() => handleDrive('STOP')}
                className={`w-14 h-10 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs transition-all select-none ${
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
              Teclado: <kbd className="px-1 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">W</kbd> <kbd className="px-1 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">A</kbd> <kbd className="px-1 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">S</kbd> <kbd className="px-1 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">D</kbd> o <kbd className="px-1 py-0.5 rounded bg-space-850 text-slate-200 border border-space-700">Espacio</kbd>
            </div>
          </div>

          {/* Tarjeta 2: Sensores Físicos DHT11 y HC-SR04 */}
          <div className="bg-space-900 border border-cyan-800/60 rounded-lg p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-space-800 pb-2 text-xs tabular-nums">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
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

            {/* DHT11 */}
            <div className="bg-space-950 p-2.5 rounded border border-space-800">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                  <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                  Sensor DHT11 · Clima
                </span>
                <span className="text-[10px] font-mono text-slate-400">GPIO 4</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
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

            {/* HC-SR04 */}
            <div className="bg-space-950 p-2.5 rounded border border-space-800">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <Waves className="w-3.5 h-3.5 text-amber-400" />
                  Sensor HC-SR04 · Sonar
                </span>
                <span className="text-[10px] font-mono text-slate-400">TRIG 5 · ECHO 18</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] text-slate-400">Distancia Frontal</div>
                  <div className="text-lg font-bold text-slate-100 tabular-nums">
                    {sensorData.distance_cm.toFixed(0)} <span className="text-xs text-slate-400">cm</span>
                    <span className="text-xs text-slate-400 ml-1.5">({(sensorData.distance_cm / 100).toFixed(2)} m)</span>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
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

          {/* Tarjeta 3: Cinemática y Batería */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-space-800 pb-2 text-xs tabular-nums">
              <span className="font-semibold text-slate-300">Cinemática & Energía</span>
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="space-y-2 text-xs tabular-nums">
              <div className="flex items-center justify-between bg-space-950 p-2 rounded border border-space-800">
                <span className="text-slate-400">Velocidad</span>
                <span className={`font-semibold ${roverSpeed !== 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
                  {roverSpeed.toFixed(2)} m/s (~{(Math.abs(roverSpeed) * 3.6).toFixed(1)} km/h)
                </span>
              </div>

              <div className="flex items-center justify-between bg-space-950 p-2 rounded border border-space-800">
                <span className="text-slate-400">Freno Automático</span>
                <span className={`font-semibold ${isObstacleClose ? 'text-rose-400' : 'text-slate-200'}`}>
                  {isObstacleClose ? 'ACTIVO (STOP HC-SR04)' : 'STANDBY'}
                </span>
              </div>

              {/* Batería */}
              <div className="bg-space-950 p-2 rounded border border-space-800">
                <div className="flex justify-between text-xs tabular-nums mb-1">
                  <span className="text-slate-400">Batería LiFePO4</span>
                  <span className="text-emerald-400 font-bold">{batteryLevel.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-space-900 h-1.5 rounded overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-colors duration-200"
                    style={{ width: `${batteryLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Conexión ESP32 */}
      {isEsp32ModalOpen && (
        <ESP32Modal
          onClose={() => setIsEsp32ModalOpen(false)}
          telemetry={{ ...sensorData, source: telemetrySource, command: drivingDirection }}
          onSelectSource={(source) => setTelemetrySource(source)}
          onTelemetryUpdate={handleTelemetryUpdate}
        />
      )}
    </div>
  );
}
