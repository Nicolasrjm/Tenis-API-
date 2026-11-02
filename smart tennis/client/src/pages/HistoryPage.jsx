import React, { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, Trophy, Zap, Crosshair } from 'lucide-react';
import { api } from '../services/api';

export default function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [shots, setShots] = useState([]);
  const [viewMode, setViewMode] = useState('sessions'); // 'sessions' or 'shots'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const [sessList, shotList] = await Promise.all([
        api.getSessions(30),
        api.getRecentShots(40)
      ]);
      setSessions(sessList || []);
      setShots(shotList || []);
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
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
            <Clock className="w-6 h-6 text-[#39FF88]" />
            <span>Histórico de Treinos & Impactos</span>
          </h1>
          <p className="text-xs text-[#8C9891] mt-1">
            Registro cronológico de todas as sessões e golpes computados pelo Motion Tennis.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center space-x-2 bg-[#07110B] p-1 rounded-xl border border-[#1B3624] text-xs font-mono">
          <button
            onClick={() => setViewMode('sessions')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              viewMode === 'sessions' ? 'bg-[#39FF88] text-[#07110B] font-bold' : 'text-[#8C9891] hover:text-[#F5F7F5]'
            }`}
          >
            Sessões Realizadas ({sessions.length})
          </button>
          <button
            onClick={() => setViewMode('shots')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              viewMode === 'shots' ? 'bg-[#39FF88] text-[#07110B] font-bold' : 'text-[#8C9891] hover:text-[#F5F7F5]'
            }`}
          >
            Jogadas Individuais ({shots.length})
          </button>
        </div>
      </div>

      {/* Content View */}
      {viewMode === 'sessions' ? (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-[#8C9891] bg-[#0C1A11] rounded-3xl border border-[#1B3624]">
              Nenhuma sessão gravada até o momento.
            </div>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88]">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="text-sm font-bold text-[#F5F7F5]">{sess.mode}</h3>
                      <span
                        data-testid={`session-wall-badge-${sess.id}`}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#16291C] text-[#39FF88] border border-[#16C96B]/30 font-bold"
                      >
                        Parede: {sess.wall_width_m && sess.wall_height_m ? `${sess.wall_width_m}m × ${sess.wall_height_m}m` : '3m × 2m'}
                      </span>
                      <span className="text-[10px] font-mono text-[#8C9891]">
                        {new Date(sess.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <span className="text-xs text-[#8C9891]">
                      {sess.hits_count} acertos em {sess.shots_count} jogadas ({sess.accuracy}% precisão)
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-[#8C9891]">VEL. MÉDIA</span>
                    <div className="font-bold text-[#F5F7F5]">{sess.avg_force} km/h</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#8C9891]">PONTUAÇÃO</span>
                    <div className="font-bold text-[#39FF88] text-sm">{sess.total_score} pts</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {shots.map((shot) => (
            <div
              key={shot.id}
              className="p-3.5 rounded-xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/30 transition-all flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-3">
                <span className={`w-2 h-2 rounded-full ${
                  shot.is_bullseye ? 'bg-[#39FF88] shadow-neon' : shot.is_hit ? 'bg-[#16C96B]' : 'bg-rose-500'
                }`}></span>
                <span className="font-semibold text-[#F5F7F5]">{shot.zone}</span>
                <span className="text-[10px] font-mono text-[#8C9891]">
                  [X: {shot.x} | Y: {shot.y}]
                </span>
              </div>

              <div className="flex items-center space-x-4 font-mono">
                <span className="text-[#8C9891]">{shot.force} km/h</span>
                <span className="text-[#39FF88] font-bold">+{shot.score} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
