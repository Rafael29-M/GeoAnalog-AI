import React from 'react';

const Meter = ({value, tone = ''}) => (
  <div className={'telemetry-meter ' + tone}>
    <span style={{width: Math.max(0, Math.min(100, Number(value) || 0)) + '%'}} />
  </div>
);

export default function RoverHUD({telemetry = {}, logs = []}) {
  const isHardware = telemetry.source === 'HARDWARE_ESP32';
  const dist = telemetry.distance_cm !== undefined ? Number(telemetry.distance_cm) : 115.0;
  
  // Evaluación de alerta por ultrasonido HC-SR04
  const isCritical = dist < 25;
  const isWarning = dist >= 25 && dist < 50;
  const obstacleStatus = isCritical ? 'ALERTA FRENO' : isWarning ? 'PRECAUCIÓN' : 'DESPEJADO';
  const obstacleTone = isCritical ? 'text-rose-400 font-bold' : isWarning ? 'text-amber-400 font-bold' : 'text-emerald-400';

  const temp = telemetry.temperature !== undefined ? Number(telemetry.temperature) : 24.5;
  const hum = telemetry.humidity !== undefined ? Number(telemetry.humidity) : 48.0;

  return (
    <section className="telemetry-strip" aria-label="Telemetría de Wall - E">
      {/* 1. Sensor DHT11: Temperatura y Humedad */}
      <div className="telemetry-cell">
        <h3>Sensor DHT11 · Clima</h3>
        <div className="telemetry-value">
          {temp.toFixed(1)}<span> °C</span>
          <small>{hum.toFixed(0)}% HR</small>
        </div>
        <p>Humedad: {hum.toFixed(1)}% <span className="telemetry-separator">·</span> {isHardware ? 'DHT11 Físico' : 'Simulación'}</p>
      </div>

      {/* 2. Sensor HC-SR04: Sonar de Proximidad Frontal */}
      <div className="telemetry-cell">
        <h3>Sensor HC-SR04 · Sonar</h3>
        <div className="telemetry-value">
          {dist.toFixed(0)}<span> cm</span>
          <small className={obstacleTone}>{obstacleStatus}</small>
        </div>
        <Meter value={Math.min(100, (dist / 200) * 100)} tone={isCritical ? 'mineral' : ''} />
        <p>Obstáculo frontal: {(dist / 100).toFixed(2)} m <span className="telemetry-separator">·</span> Pulso Eco OK</p>
      </div>

      {/* 3. Cinemática y Tracción */}
      <div className="telemetry-cell">
        <h3>Cinemática de tracción</h3>
        <div className="telemetry-value">
          {Number(telemetry.speed || 0.18).toFixed(2)} <span>m/s</span>
          <small>{telemetry.rpm || 120} rpm</small>
        </div>
        <div className="telemetry-pair">
          <span>Deslizamiento lunar</span>
          <strong>{telemetry.slipMoon || 27.1}%</strong>
        </div>
        <Meter value={telemetry.slipMoon || 27.1} tone="mineral" />
        <p className="traction-note">Riesgo de tracción: +{telemetry.tractionRisk || 18.4}%</p>
      </div>

      {/* 4. Gestión de Energía y Enlace */}
      <div className="telemetry-cell">
        <h3>Enlace & Batería</h3>
        <div className="telemetry-value">
          {telemetry.battery || 92}<span>%</span>
          <small>{isHardware ? 'ESP32 BT' : 'Sim Twin'}</small>
        </div>
        <Meter value={telemetry.battery || 92} />
        <p>{isHardware ? 'Wall - E Bluetooth SPP' : 'Digital Twin'} <span className="telemetry-separator">·</span> {telemetry.voltage || 24.8} V</p>
      </div>

      {/* 5. Registro de Actividad (ROS / ESP32 Stream) */}
      <details className="telemetry-log">
        <summary>Registro de actividad <span>{logs.length} eventos</span></summary>
        <div className="telemetry-log-lines">
          {logs.length ? (
            logs.slice(-12).map((l) => (
              <p key={l.id}>
                <time>{l.timestamp}</time>
                <span>{l.message}</span>
              </p>
            ))
          ) : (
            <p>Sin eventos registrados.</p>
          )}
        </div>
      </details>
    </section>
  );
}
