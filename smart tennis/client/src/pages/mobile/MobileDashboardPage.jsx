import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Target,
  Flame,
  PlayCircle,
  TrendingUp,
  GraduationCap,
  ArrowRight,
  Clock,
  Radio,
  Zap,
  RefreshCw,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import MobileVisitorGuard from '../../components/mobile/MobileVisitorGuard';

export default function MobileDashboardPage() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    loadData();
  }, [isGuest, user?.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [playerData, sessionsData] = await Promise.all([
        api.getPlayer().catch(() => null),
        api.getSessions(5).catch(() => [])
      ]);

      if (playerData) {
        setPlayer(playerData);
      } else if (user) {
        setPlayer(user);
      }

      setRecentSessions(Array.isArray(sessionsData) ? sessionsData : []);
    } catch (err) {
      console.warn('Erro ao carregar dashboard mobile:', err);
      setError(err.message || 'Falha ao sincronizar dados com o notebook.');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (isGuest) {
    return <MobileVisitorGuard featureName="o Painel Geral" />;
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-[#39FF88] animate-spin" />
        <span className="text-xs text-[#8C9891] font-mono">Carregando métricas do jogador...</span>
      </div>
    );
  }

  if (error && !player) {
    return (
      <div className="p-6 space-y-4">
        <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">Não foi possível carregar os dados</h3>
          <p className="text-xs text-rose-200">{error}</p>
          <button
            onClick={loadData}
            className="py-2 px-4 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 transition"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Calculate XP progress
  const currentXp = player?.xp || 0;
  const nextXp = player?.xp_next || 250;
  const xpPct = Math.min(100, Math.max(0, Math.round((currentXp / nextXp) * 100)));
  const xpRemaining = Math.max(0, nextXp - currentXp);

  return (
    <div className="p-4 sm:p-5 space-y-5 animate-fadeIn">
      
      {/* 1. Header Greeting & Equipment Info */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase text-[#8C9891] tracking-wider block">
            {getGreeting()},
          </span>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <span>{player?.name || user?.name || 'Jogador'}</span>
            <span className="text-xl">{player?.avatar || '🎾'}</span>
          </h1>
        </div>

        {/* Equipment Pill */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#0D1E13] border border-[#163020] text-[10px] font-mono text-[#8C9891]">
          <Radio className="w-3 h-3 text-[#39FF88] animate-pulse" />
          <span>MT #001</span>
        </div>
      </div>

      {/* 2. Gamified Level & XP Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0D2215] to-[#08120C] border border-[#1C4229] shadow-[0_0_20px_rgba(57,255,136,0.12)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-[#14301D] border border-[#39FF88]/50 flex items-center justify-center text-base font-black text-[#39FF88] shadow-[0_0_12px_rgba(57,255,136,0.25)]">
              {player?.level || 1}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#39FF88] font-bold">
                  NÍVEL {player?.level || 1}
                </span>
              </div>
              <h3 className="text-base font-bold text-white leading-tight">
                {player?.title || 'Tenista em Evolução'}
              </h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-[#39FF88]">{xpPct}%</span>
            <span className="text-[10px] text-[#8C9891] block">concluído</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-[#070F0A] h-2.5 rounded-full overflow-hidden border border-[#142A1B] p-0.5">
            <div
              className="bg-gradient-to-r from-[#299E5A] to-[#39FF88] h-full rounded-full transition-all duration-700 shadow-[0_0_8px_#39FF88]"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8C9891]">
            <span>{currentXp} XP</span>
            <span>Faltam {xpRemaining} XP para o LV. {(player?.level || 1) + 1}</span>
            <span>{nextXp} XP</span>
          </div>
        </div>
      </div>

      {/* 3. Core Metrics Grid (Real data from DB) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Partidas */}
        <div className="p-4 rounded-2xl bg-[#0B1710] border border-[#163020] space-y-1">
          <div className="flex items-center justify-between text-[#8C9891]">
            <span className="text-[10px] font-mono uppercase">Partidas</span>
            <Trophy className="w-4 h-4 text-[#39FF88]" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {player?.trainings_completed || recentSessions.length || 0}
          </div>
          <span className="text-[10px] text-[#6E8175] block">registradas no sistema</span>
        </div>

        {/* Precisão Real */}
        <div className="p-4 rounded-2xl bg-[#0B1710] border border-[#163020] space-y-1">
          <div className="flex items-center justify-between text-[#8C9891]">
            <span className="text-[10px] font-mono uppercase">Precisão</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {player?.precision !== undefined && player?.precision !== null ? `${player.precision}%` : 'N/A'}
          </div>
          <span className="text-[10px] text-[#6E8175] block">média dos impactos</span>
        </div>

        {/* Melhor Pontuação */}
        <div className="p-4 rounded-2xl bg-[#0B1710] border border-[#163020] space-y-1">
          <div className="flex items-center justify-between text-[#8C9891]">
            <span className="text-[10px] font-mono uppercase">Recorde</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {player?.best_score || 0} pts
          </div>
          <span className="text-[10px] text-[#6E8175] block">melhor resultado</span>
        </div>

        {/* Sequência de Treinos */}
        <div className="p-4 rounded-2xl bg-[#0B1710] border border-[#163020] space-y-1">
          <div className="flex items-center justify-between text-[#8C9891]">
            <span className="text-[10px] font-mono uppercase">Sequência</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {player?.streak_days || 1} dias
          </div>
          <span className="text-[10px] text-[#6E8175] block">ritmo consecutivo</span>
        </div>
      </div>

      {/* 4. Quick Actions / Call to Action */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/mobile/evolution')}
          data-testid="btn-dash-evolution"
          className="p-3.5 rounded-2xl bg-[#0E1E14] hover:bg-[#142B1D] border border-[#1C3E28] flex items-center justify-between text-left transition group"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#14301D] text-[#39FF88] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Evolução</span>
              <span className="text-[10px] text-[#8C9891]">Gráficos</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#8C9891] group-hover:text-[#39FF88] transition" />
        </button>

        <button
          onClick={() => navigate('/mobile/academy')}
          data-testid="btn-dash-academy"
          className="p-3.5 rounded-2xl bg-[#0E1E14] hover:bg-[#142B1D] border border-[#1C3E28] flex items-center justify-between text-left transition group"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#14301D] text-[#39FF88] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Academy</span>
              <span className="text-[10px] text-[#39FF88] font-mono">100% Grátis</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#8C9891] group-hover:text-[#39FF88] transition" />
        </button>
      </div>

      {/* 5. Recent Matches Section */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#39FF88]" />
            <span>Últimas Partidas</span>
          </h2>
          <button
            onClick={() => navigate('/mobile/history')}
            data-testid="btn-see-all-history"
            className="text-xs text-[#39FF88] hover:underline font-mono"
          >
            Ver todas →
          </button>
        </div>

        {recentSessions.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#0A140E] border border-[#142A1B] text-center space-y-2">
            <Trophy className="w-8 h-8 text-[#8C9891] mx-auto opacity-40" />
            <p className="text-xs text-white font-bold">Nenhuma partida registrada ainda</p>
            <p className="text-[11px] text-[#8C9891]">
              Inicie uma partida no notebook para registrar seus primeiros impactos.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentSessions.slice(0, 3).map((sess) => (
              <div
                key={sess.id}
                onClick={() => navigate('/mobile/history')}
                className="p-3.5 rounded-2xl bg-[#0A140E] hover:bg-[#0F1E15] border border-[#163020] flex items-center justify-between cursor-pointer transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">
                      {sess.mode || 'Treino Livre'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#122A1A] text-[#39FF88] border border-[#39FF88]/30">
                      {sess.wall_preset || '3x2'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-[#8C9891] flex items-center space-x-2">
                    <span>{sess.created_at ? new Date(sess.created_at).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                    <span>•</span>
                    <span>{sess.hits_count || 0} acertos</span>
                    {sess.accuracy ? (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{sess.accuracy}%</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-base font-black font-mono text-[#39FF88]">
                    {sess.total_score || 0}
                  </span>
                  <span className="text-[10px] text-[#8C9891] block">pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
