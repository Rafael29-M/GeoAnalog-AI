import React, { useState, useEffect } from 'react';
import { X, Cpu, Bluetooth, Wifi, CheckCircle2, Radio, Terminal, AlertTriangle, Copy, Check } from 'lucide-react';
import serialManager from '../utils/serialManager';

export const ESP32Modal = ({ onClose, telemetry = {}, onSelectSource, onTelemetryUpdate }) => {
  const [activeTab, setActiveTab] = useState('bluetooth'); // 'bluetooth' | 'wifi' | 'pinout'
  const [ip, setIp] = useState('192.168.4.1');
  const [port, setPort] = useState('8080');
  const [serialConnecting, setSerialConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isConnected = serialManager.isOpen() || telemetry?.source === 'HARDWARE_ESP32';

  // Conexión segura usando el singleton serialManager
  const handleConnectBluetoothSerial = async () => {
    setErrorMsg('');
    try {
      setSerialConnecting(true);
      await serialManager.connect((data, raw) => {
        if (onTelemetryUpdate) {
          onTelemetryUpdate(data, raw);
        }
      });

      if (onSelectSource) onSelectSource('HARDWARE_ESP32');
      setSerialConnecting(false);
    } catch (err) {
      setSerialConnecting(false);
      if (err.name === 'NotFoundError') return; // Usuario cerró el selector

      let msg = err.message || '';
      if (msg.includes('already open')) {
        // El puerto ya estaba abierto en el navegador; reutilizar enlace
        if (onSelectSource) onSelectSource('HARDWARE_ESP32');
        return;
      }
      if (msg.includes('Access denied') || msg.includes('Failed to open') || msg.includes('busy')) {
        msg = 'El puerto COM está bloqueado por otra aplicación (por ejemplo, el Monitor Serie de Arduino IDE). Cierra el Monitor Serie en Arduino IDE y vuelve a presionar Conectar.';
      } else {
        msg = 'Error al abrir el puerto Bluetooth COM: ' + msg;
      }
      setErrorMsg(msg);
    }
  };

  const handleDisconnect = async () => {
    try {
      await serialManager.disconnect();
    } catch (e) {
      console.warn(e);
    }
    if (onSelectSource) onSelectSource('SIM_PYTHON_TWIN');
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[4000] p-4 select-none backdrop-blur-sm">
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-label="Configurar ESP32" 
        className="bg-[#181d22] border border-[#343d44] rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-slate-100 font-sans"
      >
        {/* Cabecera */}
        <div className="flex justify-between items-start mb-4 border-b border-[#343d44] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bluetooth size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Wall - E Hardware Bridge · ESP32
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Bluetooth SPP
                </span>
              </h2>
              <div className="text-xs text-slate-400 font-mono">Telemetría y Manejo Bidireccional: DHT11 + HC-SR04 + Motores L298N</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar" 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Estado actual de la telemetría */}
        <div className="bg-[#12161a] border border-[#2c343b] rounded-xl p-3.5 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
            <div>
              <div className="text-xs font-semibold text-slate-200">
                {isConnected ? 'Wall - E Conectado (Control Bidireccional Activo)' : 'Enlace Hardware en Standby'}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {isConnected 
                  ? `Dispositivo: ${telemetry.device || 'Wall-E-ESP32'} • Temp: ${telemetry.temperature || '--'}°C • Sonar: ${telemetry.distance_cm || '--'} cm • Marcha: ${telemetry.command || 'STOP'}` 
                  : 'El Simulador Digital Twin está generando la telemetría activa'}
              </div>
            </div>
          </div>
          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
            isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
          }`}>
            {isConnected ? 'HARDWARE REAL' : 'SIMULADOR'}
          </span>
        </div>

        {/* Pestañas de configuración */}
        <div className="flex border-b border-[#2c343b] mb-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('bluetooth')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'bluetooth' 
                ? 'border-cyan-400 text-cyan-300 font-semibold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bluetooth size={14} />
            Bluetooth Serial (Recomendado)
          </button>
          <button
            onClick={() => setActiveTab('pinout')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'pinout' 
                ? 'border-cyan-400 text-cyan-300 font-semibold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu size={14} />
            Pines: Sensores y Motores
          </button>
          <button
            onClick={() => setActiveTab('wifi')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'wifi' 
                ? 'border-cyan-400 text-cyan-300 font-semibold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi size={14} />
            Wi-Fi / WebSocket
          </button>
        </div>

        {/* Mensaje de error si ocurre */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-950/50 border border-rose-700 rounded-lg text-rose-200 text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            <div>
              <div className="font-bold text-rose-300 mb-0.5">Aviso de conexión de puerto:</div>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Contenido Pestaña 1: Bluetooth */}
        {activeTab === 'bluetooth' && (
          <div className="space-y-4 mb-5">
            <div className="bg-[#12161a] p-4 rounded-lg border border-[#2c343b] text-xs space-y-2">
              <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                <span>Paso a Paso para Conectar por Bluetooth en Windows:</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                <li>Sube el firmware <code className="bg-space-850 px-1 py-0.5 rounded text-cyan-300">ESP32_Rover_Bluetooth.ino</code> al ESP32 con Arduino IDE.</li>
                <li><strong>Cierra el Monitor Serie de Arduino IDE</strong> (si está abierto, bloquea el puerto COM en Windows).</li>
                <li>En Windows ve a: <strong>Configuración ➔ Bluetooth y dispositivos ➔ Agregar dispositivo</strong>.</li>
                <li>Selecciona <strong>"Wall-E-ESP32"</strong> y empareja (no requiere PIN o usa 1234).</li>
                <li>Haz clic en el botón abajo y selecciona el puerto COM creado por Windows.</li>
              </ol>
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <button
                  onClick={handleConnectBluetoothSerial}
                  disabled={serialConnecting}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Bluetooth size={15} />
                  <span>{serialConnecting ? 'Abriendo Puerto COM...' : 'Conectar vía Puerto COM Bluetooth'}</span>
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Desconectar Wall - E (Volver a Simulación)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contenido Pestaña 2: Pinout de Sensores y Motores */}
        {activeTab === 'pinout' && (
          <div className="space-y-4 mb-5">
            <div className="bg-[#12161a] p-4 rounded-lg border border-[#2c343b] text-xs">
              <h4 className="font-semibold text-slate-200 mb-2.5">Diagrama de Cableado Completo (ESP32 DevKit):</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] font-mono">
                {/* DHT11 */}
                <div className="p-3 bg-[#181e23] border border-space-800 rounded">
                  <div className="text-cyan-400 font-bold mb-1.5">Sensor DHT11</div>
                  <div className="space-y-1 text-slate-300 text-[10px]">
                    <div>• <strong>VCC</strong> ➔ 3.3V</div>
                    <div>• <strong>DATA</strong> ➔ <strong>GPIO 4</strong></div>
                    <div>• <strong>GND</strong> ➔ GND</div>
                  </div>
                </div>

                {/* HC-SR04 */}
                <div className="p-3 bg-[#181e23] border border-space-800 rounded">
                  <div className="text-amber-400 font-bold mb-1.5">Sensor HC-SR04</div>
                  <div className="space-y-1 text-slate-300 text-[10px]">
                    <div>• <strong>VCC</strong> ➔ 5V (VIN)</div>
                    <div>• <strong>TRIG</strong> ➔ <strong>GPIO 5</strong></div>
                    <div>• <strong>ECHO</strong> ➔ <strong>GPIO 18</strong></div>
                    <div>• <strong>GND</strong> ➔ GND</div>
                  </div>
                </div>

                {/* Motores L298N */}
                <div className="p-3 bg-[#181e23] border border-space-800 rounded">
                  <div className="text-emerald-400 font-bold mb-1.5">Driver Motores L298N</div>
                  <div className="space-y-1 text-slate-300 text-[10px]">
                    <div>• <strong>IN1</strong> ➔ <strong>GPIO 26</strong> (Izq Fwd)</div>
                    <div>• <strong>IN2</strong> ➔ <strong>GPIO 27</strong> (Izq Rev)</div>
                    <div>• <strong>IN3</strong> ➔ <strong>GPIO 14</strong> (Der Fwd)</div>
                    <div>• <strong>IN4</strong> ➔ <strong>GPIO 12</strong> (Der Rev)</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-400">
                * El código fuente completo para Arduino IDE está guardado en: <span className="text-slate-300 font-mono">backend/firmware/ESP32_Rover_Bluetooth.ino</span>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Pestaña 3: Wi-Fi */}
        {activeTab === 'wifi' && (
          <div className="space-y-4 mb-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">IP DEL ESP32</label>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  className="w-full bg-[#12161a] border border-[#343d44] rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">PUERTO WEBSOCKET</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full bg-[#12161a] border border-[#343d44] rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (onSelectSource) onSelectSource('HARDWARE_ESP32');
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              <Wifi size={14} />
              <span>Conectar vía WebSocket Wi-Fi</span>
            </button>
          </div>
        )}

        {/* Botón de cierre */}
        <div className="flex justify-end pt-2 border-t border-[#343d44]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#48535b] hover:bg-white/5 text-slate-300 text-xs transition-colors font-medium"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};

export default ESP32Modal;
