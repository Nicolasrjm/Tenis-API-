import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Target, 
  Activity, 
  Zap, 
  Shield, 
  Sparkles, 
  Compass, 
  CheckCircle2, 
  AlertCircle, 
  PlayCircle,
  Video,
  Award
} from 'lucide-react';
import { api } from '../services/api';

export default function SkillDetailPage({ skillKey, onBack, onStartTraining }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSkillDetail();
  }, [skillKey]);

  const loadSkillDetail = async () => {
    try {
      const res = await api.getAttributeDetail(skillKey);
      setData(res);
    } catch (e) {
      console.error('Erro ao carregar detalhes da habilidade:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data?.attribute) {
    return (
      <div className="p-12 text-center text-xs font-mono text-[#8C9891] animate-pulse">
        Carregando telemetria da habilidade...
      </div>
    );
  }

  const attr = data.attribute;
  const pct = Math.min(100, Math.round((attr.xp / attr.xp_next) * 100));

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
      
      
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-xs font-bold text-[#8C9891] hover:text-[#39FF88] transition-colors font-mono"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>VOLTAR PARA EVOLUÇÃO</span>
      </button>

      
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-6">
        
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1B3624]">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-[#102216] border border-[#39FF88] flex items-center justify-center text-2xl shadow-neon">
              🎾
            </div>
            <div>
              <span className="text-[10px] font-mono text-[#39FF88] uppercase tracking-widest font-bold">
                HABILIDADE DO ATLETA
              </span>
              <h1 className="text-3xl font-black text-[#F5F7F5] uppercase">
                {attr.name}
              </h1>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-xs text-[#8C9891]">NÍVEL DA HABILIDADE</span>
            <div className="text-2xl font-black text-[#39FF88]">
              LV. {attr.level} / {attr.max_level}
            </div>
          </div>
        </div>

        
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#8C9891]">EXPERIÊNCIA DE {attr.name.toUpperCase()}</span>
            <span className="text-[#39FF88] font-bold">{attr.xp} / {attr.xp_next} XP ({pct}%)</span>
          </div>
          <div className="w-full h-3 rounded-full bg-[#07110B] border border-[#1B3624] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#16C96B] to-[#39FF88] rounded-full transition-all duration-700 shadow-neon-sm"
              style={{ width: `${pct}%` }}
            ></div>
          </div>
        </div>

        
        <div className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] space-y-1">
          <span className="text-[10px] font-mono text-[#39FF88] uppercase font-bold tracking-wider">
            OBJETIVO ATUAL DO TREINADOR
          </span>
          <p className="text-sm font-semibold text-[#F5F7F5]">
            {attr.objective || 'Manter regularidade nas séries de treino.'}
          </p>
        </div>

        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="p-5 rounded-2xl bg-[#07110B]/80 border border-[#1B3624] space-y-2">
            <div className="flex items-center space-x-2 text-[#39FF88] text-xs font-bold font-mono">
              <CheckCircle2 className="w-4 h-4" />
              <span>PONTOS FORTES OBSERVADOS</span>
            </div>
            <p className="text-xs text-[#8C9891] leading-relaxed">
              {attr.strong_points}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#07110B]/80 border border-[#1B3624] space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold font-mono">
              <AlertCircle className="w-4 h-4" />
              <span>PONTOS QUE PRECISAM SER MELHORADOS</span>
            </div>
            <p className="text-xs text-[#8C9891] leading-relaxed">
              {attr.improvement_points}
            </p>
          </div>

        </div>

        
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#102216] to-[#0A170F] border border-[#39FF88]/40 space-y-3 relative overflow-hidden shadow-neon-sm">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-[#39FF88] uppercase tracking-wider bg-[#39FF88]/15 px-2.5 py-1 rounded">
              DICA DO TREINADOR
            </span>
          </div>

          <p className="text-sm text-[#F5F7F5] font-medium leading-relaxed italic">
            "{attr.coach_tip}"
          </p>

          
          <div className="pt-3 border-t border-[#1B3624] flex items-center space-x-2 text-[11px] font-mono text-[#8C9891]">
            <Video className="w-4 h-4 text-[#39FF88]" />
            <span>Módulo de Vídeo: {data.videoIntegration?.placeholderText}</span>
          </div>
        </div>

        
        <div className="pt-2">
          <button
            onClick={() => onStartTraining(attr.key)}
            className="w-full py-4 px-6 rounded-2xl btn-neon font-black text-sm tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon-strong"
          >
            <PlayCircle className="w-5 h-5" />
            <span>INICIAR TREINO DE {attr.name.toUpperCase()}</span>
          </button>
        </div>

      </div>

    </div>
  );
}
