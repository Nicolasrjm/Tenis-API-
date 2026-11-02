import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle2, Lock, Zap } from 'lucide-react';
import { api } from '../services/api';

export default function AchievementsPage() {
  const [data, setData] = useState({ achievements: [], unlockedCount: 0, total: 0, completionRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const res = await api.getAchievements();
      setData(res || { achievements: [], unlockedCount: 0, total: 0, completionRate: 0 });
    } catch (e) {
      console.error('Erro ao carregar conquistas:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5] flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            <span>Conquistas & Troféus do Atleta</span>
          </h1>
          <p className="text-xs text-[#8C9891] mt-1">
            Marcos esportivos desbloqueados com base na precisão, consistência e frequência dos seus treinos.
          </p>
        </div>

        {/* Progress pill */}
        <div className="flex items-center space-x-3 bg-[#07110B] px-4 py-2 rounded-2xl border border-[#1B3624] font-mono">
          <div className="text-right">
            <div className="text-[10px] text-[#8C9891]">PROGRESSO GERAL</div>
            <div className="text-sm font-bold text-[#39FF88]">
              {data.unlockedCount} / {data.total} Conquistas ({data.completionRate}%)
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Achievements (Requirement 18) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(data.achievements || []).map((ach) => {
          const isUnlocked = ach.unlocked === 1;
          const progressPct = Math.min(100, Math.round(((ach.progress || 0) / ach.target) * 100));

          return (
            <div
              key={ach.id}
              className={`p-6 rounded-3xl border transition-all flex flex-col justify-between ${
                isUnlocked
                  ? 'bg-[#0E2014] border-[#39FF88]/40 shadow-neon-sm'
                  : 'bg-[#0A160E] border-[#1B3624] opacity-75'
              }`}
            >
              <div className="space-y-3">
                
                {/* Top icon & status */}
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border ${
                    isUnlocked
                      ? 'bg-[#102216] border-[#39FF88] shadow-neon'
                      : 'bg-[#07110B] border-[#1B3624] grayscale'
                  }`}>
                    {ach.icon || '🏆'}
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isUnlocked
                      ? 'bg-[#39FF88]/20 text-[#39FF88] border-[#39FF88]/40'
                      : 'bg-[#122419] text-[#8C9891] border-[#1B3624]'
                  }`}>
                    {isUnlocked ? 'DESBLOQUEADA' : 'BLOQUEADA'}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-lg font-black text-[#F5F7F5]">
                    {ach.title}
                  </h3>
                  <p className="text-xs text-[#8C9891] mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                </div>

              </div>

              {/* Progress & Reward */}
              <div className="mt-6 pt-4 border-t border-[#1B3624] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#8C9891]">
                    Progresso: {ach.progress || 0} / {ach.target}
                  </span>
                  <span className="text-[#39FF88] font-bold">
                    +{ach.xp_reward} XP
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-[#07110B] border border-[#1B3624] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isUnlocked ? 'bg-[#39FF88]' : 'bg-[#16C96B]/50'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>

                {isUnlocked && ach.unlocked_at && (
                  <div className="text-[10px] font-mono text-[#8C9891] text-right">
                    Conquistada em {new Date(ach.unlocked_at).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
