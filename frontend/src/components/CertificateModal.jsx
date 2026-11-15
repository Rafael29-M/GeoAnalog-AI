import React from 'react';
import { X, ShieldCheck, Download, Printer, DollarSign, TrendingDown } from 'lucide-react';

export const CertificateModal = ({ onClose, comparison, selectedBody = 'MOON' }) => {
  const isMoon = selectedBody === 'MOON' || selectedBody === 'moon';
  const targetName = comparison?.target.name || (isMoon ? 'Mar de la Tranquilidad' : 'Cráter Jezero');
  const analogName = comparison?.earthAnalog.name || (isMoon ? 'Salar de Atacama, Chile' : 'Lago Salda, Turquía');
  const matchPct = comparison?.earthAnalog.matchPercentage || '92.0%';
  const docId = isMoon ? 'NASA ARTEMIS FLIGHT READINESS DOC #883-AT' : 'NASA MARS SAMPLE RETURN FLIGHT DOC #421-SL';

  const missionCost = isMoon ? '$150,000,000' : '$2,400,000,000';
  const analogCampaignCost = '$250,000';
  const riskMitigated = '78%';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[4000] p-4 select-none">
      <div role="dialog" aria-modal="true" aria-label="Reporte de comparación" onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab') {
          const items = [...event.currentTarget.querySelectorAll('button:not([disabled]), input, select, a[href]')];
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }} className="bg-[#1d2328] border border-[#343d44] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-slate-100 font-sans">
        {/* Cabecera del Certificado */}
        <div className="flex justify-between items-start mb-5 border-b border-[#343d44] pb-4">
          <div className="flex gap-3 items-center">
            <div className="w-11 h-11 rounded-xl bg-slate-500/20 border border-slate-500/40 flex items-center justify-center text-slate-400 ">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 leading-tight">
                Certificado de Fidelidad Análoga
              </h2>
              <div className="text-[11px] text-slate-400 font-mono font-bold  mt-0.5">
                {docId}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar" autoFocus
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. MATRIZ DE VALIDACIÓN DE TERRENO */}
        <div className="bg-[#15191d] border border-[#343d44] rounded-xl p-3.5 mb-3.5">
          <div className="text-[10px] text-slate-400 font-mono font-bold  mb-2">
            1. MATRIZ DE VALIDACIÓN DE TERRENO
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-slate-400 text-[11px]">{isMoon ? 'Alunizaje Objetivo:' : 'Aterrizaje Objetivo:'}</div>
              <div className="font-bold text-slate-100 font-sans">{targetName}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px]">Sitio Terrestre Homólogo:</div>
              <div className="font-bold text-emerald-400 font-sans">{analogName}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px]">Similitud Geotécnica Global:</div>
              <div className="font-mono font-semibold text-slate-400 text-sm">{matchPct}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px]">Colección NASA Earthdata:</div>
              <div className="font-mono text-slate-300 text-[11px]">{comparison?.earthAnalog.nasaEarthdataCollection || 'C2105092163-LAADS'}</div>
            </div>
          </div>
        </div>

        {/* 2. ROI & COSTES AHORRADOS */}
        <div className="bg-[#15191d] border border-[#343d44] rounded-xl p-3.5 mb-5">
          <div className="text-[10px] text-emerald-400 font-mono font-bold  mb-2 flex items-center justify-between">
            <span>2. ANÁLISIS DE RIESGO Y COSTES MITIGADOS (ROI)</span>
            <span className="text-emerald-400 font-mono text-xs">{riskMitigated} REDUCCIÓN</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#252c32] rounded-lg p-2 border border-[#343d44]">
              <div className="text-[10px] text-slate-400">Coste Misión Vuelo</div>
              <div className="text-xs font-mono font-bold text-rose-400 mt-0.5">{missionCost}</div>
            </div>
            <div className="bg-[#252c32] rounded-lg p-2 border border-[#343d44]">
              <div className="text-[10px] text-slate-400">Campaña en Análogo</div>
              <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">{analogCampaignCost}</div>
            </div>
            <div className="bg-[#252c32] rounded-lg p-2 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400">Ahorro en Riesgo</div>
              <div className="text-xs font-mono font-semibold text-emerald-300 mt-0.5">$149,750,000</div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2.5">
          <button
            onClick={handlePrint}
            className="flex-1 bg-slate-600 hover:bg-slate-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Printer size={14} />
            <span>Imprimir / Exportar PDF Oficial</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[#48535b] hover:bg-white/5 text-slate-300 text-xs transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CertificateModal;
