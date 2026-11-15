import React from 'react';

export const RadarChart = ({
  targetValues = [0.85, 0.78, 0.65, 0.90, 0.82],
  analogValues = [0.88, 0.74, 0.70, 0.84, 0.80],
  targetName = 'Copérnico',
  analogName = 'Atacama'
}) => {
  const size = 190;
  const center = size / 2;
  const radius = 62;
  const labels = ['Pendiente', 'Rugosidad', 'Albedo', 'Temp Δ', 'Espectro'];
  const totalAxes = 5;

  const getCoordinates = (value, index) => {
    const angle = (Math.PI * 2 * index) / totalAxes - Math.PI / 2;
    const x = center + radius * value * Math.cos(angle);
    const y = center + radius * value * Math.sin(angle);
    return { x, y };
  };

  const targetPoints = targetValues
    .map((v, i) => {
      const { x, y } = getCoordinates(v, i);
      return `${x},${y}`;
    })
    .join(' ');

  const analogPoints = analogValues
    .map((v, i) => {
      const { x, y } = getCoordinates(v, i);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex flex-wrap gap-2 justify-between items-center w-full text-[11px] text-slate-400 mb-1 px-1">
        <span className="font-semibold text-slate-200   text-xs">Perfil del terreno</span>
        <div className="flex gap-2.5 tabular-nums text-xs">
          <span className="text-slate-400 font-bold">— {targetName}</span>
          <span className="text-emerald-400 font-bold">— {analogName}</span>
        </div>
      </div>

      <svg role="img" aria-label="Comparación de cinco variables del terreno" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Anillos concéntricos del pentágono */}
        {[0.25, 0.5, 0.75, 1.0].map((level, lvlIdx) => {
          const ringPoints = Array.from({ length: totalAxes })
            .map((_, i) => {
              const { x, y } = getCoordinates(level, i);
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <polygon
              key={lvlIdx}
              points={ringPoints}
              fill="none"
              stroke="#334155"
              strokeWidth="0.8"
              strokeDasharray={level === 1 ? 'none' : '2,2'}
            />
          );
        })}

        {/* Ejes radiales y etiquetas */}
        {Array.from({ length: totalAxes }).map((_, i) => {
          const { x, y } = getCoordinates(1.0, i);
          const labelCoord = getCoordinates(1.22, i);
          return (
            <g key={i}>
              <line
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#334155"
                strokeWidth="0.8"
              />
              <text
                x={labelCoord.x}
                y={labelCoord.y + 3}
                fill="#94a3b8"
                fontSize="8.5"
                fontFamily="system-ui, sans-serif"
                textAnchor="middle"
              >
                {labels[i]}
              </text>
            </g>
          );
        })}

        {/* Polígono 1: Target Extraterrestre (Cyan) */}
        <polygon
          points={targetPoints}
          fill="rgba(185, 198, 204, 0.12)"
          stroke="#b9c6cc"
          strokeWidth="1.6"
        />

        {/* Polígono 2: Análogo Terrestre (Emerald) */}
        <polygon
          points={analogPoints}
          fill="rgba(164, 182, 157, 0.12)"
          stroke="#a4b69d"
          strokeWidth="1.6"
        />
      </svg>
    </div>
  );
};

export default RadarChart;
