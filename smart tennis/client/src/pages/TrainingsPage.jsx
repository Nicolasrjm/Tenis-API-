import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Zap, 
  Target, 
  Play, 
  Flame, 
  CheckCircle2, 
  ShieldCheck, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

export default function TrainingsPage({ onLaunchDrill }) {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrainings();
  }, []);

  const loadTrainings = async () => {
    try {
      const res = await api.getTrainings();
      setTrainings(res || []);
    } catch (e) {
      console.error('Erro ao carregar treinamentos:', e);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (diff) => {
    if (diff === 'Iniciante') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (diff === 'Médio') return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto">
      
      
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5] flex items-center space-x-2">
            <Award className="w-6 h-6 text-[#39FF88]" />
            <span>Treinamentos & Séries Técnicas</span>
          </h1>
          <p className="text-xs text-[#8C9891] mt-1">
            Módulos práticos de exercícios configurados para calibrar reflexo, precisão e potência do jogador.
          </p>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainings.map((t) => (
          <div
            key={t.id}
            className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/50 transition-all flex flex-col justify-between group shadow-sm hover:shadow-neon-sm"
          >
            <div className="space-y-4">
              
              
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${getDifficultyColor(t.difficulty)}`}>
                  {t.difficulty}
                </span>

                <div className="flex items-center space-x-1 font-mono text-xs text-[#39FF88] font-bold">
                  <Zap className="w-3.5 h-3.5" />
                  <span>+{t.xp_reward} XP</span>
                </div>
              </div>

              
              <div>
                <h3 className="text-xl font-black text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors">
                  {t.title}
                </h3>
                <span className="text-[11px] font-mono text-[#8C9891]">
                  Foco: <span className="text-[#39FF88]">{t.attribute_name}</span> • {t.shot_count} Jogadas
                </span>
              </div>

              
              <p className="text-xs text-[#8C9891] leading-relaxed">
                {t.description}
              </p>

              
              <div className="p-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-xs space-y-1">
                <div className="font-bold text-[#F5F7F5] flex items-center space-x-1.5">
                  <Target className="w-3.5 h-3.5 text-[#39FF88]" />
                  <span>Objetivo do Treino:</span>
                </div>
                <p className="text-[#8C9891] text-[11px] pl-5">
                  {t.objective}
                </p>
              </div>

            </div>

            
            <div className="pt-6">
              <button
                onClick={() => onLaunchDrill(t)}
                className="w-full py-3 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon group-hover:scale-[1.02] transition-transform"
              >
                <span>INICIAR TREINAMENTO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
