import React, { useState, useEffect } from 'react';
import {
  Clock,
  Filter,
  Trophy,
  Target,
  Zap,
  Activity,
  Layers,
  X,
  RefreshCw,
  Cpu,
  MousePointer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import MobileVisitorGuard from '../../components/mobile/MobileVisitorGuard';

export default function MobileHistoryPage() {
  const { isGuest } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('Todos');
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    loadSessions();
  }, [isGuest]);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSessions(50);
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  if (isGuest) {
    return <MobileVisitorGuard featureName="o Histórico de Partidas" />;
  }

  // Filter modes
  const modes = ['Todos', 'Treino Livre', 'Liga um por vez', 'Apagar todos'];

  const filteredSessions = sessions.filter((s) => {
    if (filterMode === 'Todos') return true;
    const modeName = (s.mode || '').toLowerCase();
    return modeName.includes(filterMode.toLowerCase());
  });

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Data não informada';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 animate-fadeIn">
      
      {/* Top Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#39FF88]" />
            <span>Histórico de Treinos</span>
          </h1>
          <p className="text-xs text-[#8C9891]">
            Todas as partidas registradas na sua conta
          </p>
        </div>
        <button
          onClick={loadSessions}
          disabled={loading}
          className="p-2 rounded-xl bg-[#0D1E13] border border-[#163020] text-[#8C9891] hover:text-[#39FF88] transition"
          title="Recarregar histórico"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#39FF88]' : ''}`} />
        </button>
      </div>

      {/* Mode Filter Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {modes.map((mode) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              filterMode === mode
                ? 'bg-[#39FF88] text-slate-950 shadow-[0_0_10px_rgba(57,255,136,0.2)]'
                : 'bg-[#0D1E13] border border-[#163020] text-[#8C9891] hover:text-white'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-6 h-6 text-[#39FF88] animate-spin" />
          <span className="text-xs text-[#8C9891]">Buscando partidas salvas...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-center space-y-2">
          <p className="text-xs text-rose-200">{error}</p>
          <button
            onClick={loadSessions}
            className="py-1.5 px-3 rounded-lg bg-slate-800 text-xs font-bold text-white"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredSessions.length === 0 && (
        <div className="p-8 rounded-3xl bg-[#0A140E] border border-[#142A1B] text-center space-y-3 my-6">
          <Trophy className="w-10 h-10 text-[#8C9891] mx-auto opacity-30" />
          <h3 className="text-sm font-bold text-white">Nenhum treino encontrado</h3>
          <p className="text-xs text-[#8C9891] max-w-xs mx-auto">
            {filterMode === 'Todos'
              ? 'Você ainda não jogou nenhuma partida registrada. Conecte o app ao notebook e faça seu primeiro treino!'
              : `Nenhuma partida com o filtro "${filterMode}".`}
          </p>
        </div>
      )}

      {/* Match Cards List */}
      <div className="space-y-3">
        {filteredSessions.map((sess) => {
          const isHardware = sess.is_simulation === 0;
          return (
            <div
              key={sess.id}
              onClick={() => setSelectedSession(sess)}
              data-testid={`match-card-${sess.id}`}
              className="p-4 rounded-2xl bg-[#0A140E] hover:bg-[#0F1F16] border border-[#163020] hover:border-[#39FF88]/40 transition cursor-pointer space-y-3 shadow-sm group"
            >
              {/* Header: Mode & Date */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white group-hover:text-[#39FF88] transition">
                      {sess.mode || 'Treino Livre'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#122A1A] text-[#39FF88] border border-[#39FF88]/30">
                      {sess.wall_preset || '3x2'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#8C9891] block mt-0.5">
                    {formatDate(sess.created_at)}
                  </span>
                </div>

                {/* Score */}
                <div className="text-right">
                  <span className="text-lg font-black font-mono text-[#39FF88]">
                    {sess.total_score || 0}
                  </span>
                  <span className="text-[10px] text-[#8C9891] block uppercase font-mono">pts</span>
                </div>
              </div>

              {/* Metrics Pill Row */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-[#A2C7AE]">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{sess.hits_count || 0} acertos</span>
                  </span>
                  {sess.accuracy !== null && sess.accuracy !== undefined && (
                    <span className="text-emerald-400 font-bold">
                      {sess.accuracy}%
                    </span>
                  )}
                  <span className="flex items-center space-x-1 text-[#8C9891]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDuration(sess.duration_seconds)}</span>
                  </span>
                </div>

                {/* Origin Badge */}
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono flex items-center space-x-1 ${
                  isHardware
                    ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
                    : 'bg-[#122A1A] border border-[#39FF88]/30 text-[#39FF88]'
                }`}>
                  {isHardware ? (
                    <>
                      <Cpu className="w-3 h-3 text-amber-400" />
                      <span>Hardware</span>
                    </>
                  ) : (
                    <>
                      <MousePointer className="w-3 h-3 text-[#39FF88]" />
                      <span>Simulação</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Match Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0C1911] border-t sm:border border-[#1E3E28] rounded-t-3xl sm:rounded-3xl p-6 text-[#F5F7F5] space-y-5 animate-slideUp">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#14301D] text-[#39FF88]">
                    {selectedSession.wall_preset || '3x2'}
                  </span>
                  <span className="text-xs text-[#8C9891] font-mono">
                    {formatDate(selectedSession.created_at)}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {selectedSession.mode || 'Treino Livre'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-2 rounded-full bg-[#122518] hover:bg-[#1A3824] text-[#8C9891] hover:text-white"
                aria-label="Fechar detalhes"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Score Banner */}
            <div className="p-4 rounded-2xl bg-[#07110B] border border-[#183722] flex items-center justify-around text-center">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#8C9891] block">Pontuação</span>
                <span className="text-2xl font-black font-mono text-[#39FF88]">
                  {selectedSession.total_score || 0}
                </span>
              </div>
              <div className="w-px h-8 bg-[#183722]" />
              <div>
                <span className="text-[10px] font-mono uppercase text-[#8C9891] block">Precisão</span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {selectedSession.accuracy || 0}%
                </span>
              </div>
              <div className="w-px h-8 bg-[#183722]" />
              <div>
                <span className="text-[10px] font-mono uppercase text-[#8C9891] block">Duração</span>
                <span className="text-2xl font-black font-mono text-white">
                  {formatDuration(selectedSession.duration_seconds)}
                </span>
              </div>
            </div>

            {/* Detailed Metrics List */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2.5 rounded-xl bg-[#08120B]">
                <span className="text-[#8C9891]">Impactos computados:</span>
                <span className="text-white font-bold">{selectedSession.hits_count || 0} de {selectedSession.shots_count || selectedSession.hits_count || 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#08120B]">
                <span className="text-[#8C9891]">Dimensões físicas da parede:</span>
                <span className="text-[#39FF88] font-bold">
                  {selectedSession.wall_width_m || 3.0}m × {selectedSession.wall_height_m || 2.0}m
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#08120B]">
                <span className="text-[#8C9891]">Força média dos golpes:</span>
                <span className="text-white font-bold">{selectedSession.avg_force || 80} km/h (estimada)</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#08120B]">
                <span className="text-[#8C9891]">Origem dos eventos:</span>
                <span className="text-white font-bold">
                  {selectedSession.is_simulation === 0 ? 'Sensores Acústicos KY-037' : 'Simulação Manual por Mouse'}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#08120B]">
                <span className="text-[#8C9891]">Identificador da sessão:</span>
                <span className="text-[#8C9891] text-[10px] truncate max-w-[180px]">{selectedSession.id}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedSession(null)}
              className="w-full py-3 rounded-xl bg-[#14301D] hover:bg-[#1A3E26] text-[#39FF88] font-bold text-xs uppercase tracking-wider transition"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
