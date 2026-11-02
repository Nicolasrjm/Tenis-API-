import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Target, Zap, Calendar, Download } from 'lucide-react';
import { api } from '../../services/api';

export default function AdminReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetStats?.();
      setStats(res);
    } catch (e) {
      // Fallback demo
      setStats({
        totalSessions: period === '7d' ? 42 : period === '30d' ? 187 : 634,
        totalHits: period === '7d' ? 1024 : period === '30d' ? 4820 : 18340,
        avgAccuracy: 82,
        topPlayers: [
          { name: 'Nicolas', sessions: 28, hits: 672, accuracy: 87 },
          { name: 'Demo Player', sessions: 14, hits: 352, accuracy: 74 },
        ],
        modeDistribution: [
          { mode: 'Treino Livre', count: 22, pct: 52 },
          { mode: 'Alvo Único', count: 13, pct: 31 },
          { mode: 'Apague Todos', count: 7, pct: 17 },
        ],
        topSensors: [
          { id: 5, label: 'Centro (Bullseye)', hits: 234 },
          { id: 2, label: 'Centro Superior', hits: 187 },
          { id: 8, label: 'Centro Inferior', hits: 156 },
          { id: 4, label: 'Centro Esquerdo', hits: 144 },
          { id: 6, label: 'Centro Direito', hits: 138 },
        ],
        weeklyTrend: [120, 145, 98, 167, 203, 185, 247],
      });
    } finally {
      setLoading(false);
    }
  };

  const periodOptions = [
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: 'all', label: 'Todo período' },
  ];

  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const maxTrend = Math.max(...(stats?.weeklyTrend || [1]));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-amber-400 tracking-wide">RELATÓRIOS</h1>
          <p className="text-[#8C9891] text-sm mt-1">Análise de desempenho e utilização da plataforma</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="bg-[#0C1A11] border border-[#1B3624] rounded-xl px-3 py-2 text-[#F5F7F5] text-sm focus:outline-none focus:border-amber-400/50"
          >
            {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20 text-amber-400 px-4 py-2 rounded-xl text-sm transition-all">
            <Download size={14} />
            Exportar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[#8C9891]">Carregando relatórios...</div>
      ) : (
        <>
          {/* Main KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Sessões', value: stats?.totalSessions, icon: Calendar, color: 'text-amber-400' },
              { label: 'Total de Acertos', value: stats?.totalHits?.toLocaleString('pt-BR'), icon: Target, color: 'text-[#39FF88]' },
              { label: 'Precisão Média', value: `${stats?.avgAccuracy}%`, icon: TrendingUp, color: 'text-blue-400' },
              { label: 'Jogadores Ativos', value: stats?.topPlayers?.length, icon: Zap, color: 'text-purple-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className={color} />
                  <span className="text-[#8C9891] text-xs uppercase tracking-wider">{label}</span>
                </div>
                <div className={`text-2xl font-black ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Trend Bar Chart */}
            <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-6">
              <h2 className="text-sm font-bold text-[#8C9891] uppercase tracking-wider mb-6 flex items-center gap-2">
                <BarChart2 size={14} />
                Acertos por Dia (Última Semana)
              </h2>
              <div className="flex items-end gap-2 h-40">
                {(stats?.weeklyTrend || []).map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-[#8C9891]">{val}</div>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#16C96B] to-[#39FF88] transition-all"
                      style={{ height: `${(val / maxTrend) * 100}%`, minHeight: '4px' }}
                    />
                    <div className="text-xs text-[#8C9891] font-medium">{days[i]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mode Distribution */}
            <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-6">
              <h2 className="text-sm font-bold text-[#8C9891] uppercase tracking-wider mb-6 flex items-center gap-2">
                <Target size={14} />
                Distribuição por Modo
              </h2>
              <div className="space-y-4">
                {(stats?.modeDistribution || []).map((m, i) => {
                  const colors = ['#39FF88', '#60a5fa', '#f59e0b'];
                  return (
                    <div key={m.mode}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#F5F7F5] font-medium">{m.mode}</span>
                        <span style={{ color: colors[i] }} className="font-bold">{m.pct}%</span>
                      </div>
                      <div className="h-2 bg-[#1B3624] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${m.pct}%`, backgroundColor: colors[i] }} />
                      </div>
                      <div className="text-xs text-[#8C9891] mt-0.5">{m.count} sessões</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Players */}
            <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-6">
              <h2 className="text-sm font-bold text-[#8C9891] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Zap size={14} />
                Top Jogadores
              </h2>
              <div className="space-y-3">
                {(stats?.topPlayers || []).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 p-3 rounded-xl bg-[#07110B] border border-[#1B3624]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-[#1B3624] text-[#8C9891]'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-[#F5F7F5] font-bold text-sm">{p.name}</div>
                      <div className="text-[#8C9891] text-xs">{p.sessions} sessões • {p.hits} acertos</div>
                    </div>
                    <div className={`text-sm font-black ${p.accuracy >= 80 ? 'text-[#39FF88]' : 'text-[#8C9891]'}`}>
                      {p.accuracy}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Sensors */}
            <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-6">
              <h2 className="text-sm font-bold text-[#8C9891] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Target size={14} />
                Sensores Mais Ativados
              </h2>
              <div className="space-y-3">
                {(stats?.topSensors || []).map((s, i) => {
                  const maxS = stats.topSensors[0]?.hits || 1;
                  return (
                    <div key={s.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#F5F7F5]">#{s.id} — {s.label}</span>
                        <span className="text-[#39FF88] font-bold">{s.hits}</span>
                      </div>
                      <div className="h-1.5 bg-[#1B3624] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#39FF88] transition-all" style={{ width: `${(s.hits / maxS) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
