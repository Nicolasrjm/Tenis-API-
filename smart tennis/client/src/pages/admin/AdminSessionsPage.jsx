import React, { useState, useEffect } from 'react';
import { Activity, Clock, User, Zap, Filter, Search, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const res = await api.adminGetSessions();
      setSessions(res || []);
    } catch (e) {
      console.error('Erro ao carregar sessões:', e);
      // Fallback demo data
      setSessions([
        { id: 1, player_name: 'Nicolas', equipment_name: 'ST-001', mode: 'free', hits: 24, score: 3200, accuracy: 87, duration_min: 18, created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 2, player_name: 'Nicolas', equipment_name: 'ST-001', mode: 'single', hits: 15, score: 2100, accuracy: 75, duration_min: 12, created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, player_name: 'Nicolas', equipment_name: 'ST-002', mode: 'clear_all', hits: 11, score: 1800, accuracy: 91, duration_min: 8, created_at: new Date(Date.now() - 172800000).toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const modeLabel = (mode) => {
    const map = { free: 'Treino Livre', single: 'Alvo Único', clear_all: 'Apague Todos' };
    return map[mode] || mode;
  };

  const modeColor = (mode) => {
    const map = { free: 'text-[#39FF88] bg-[#39FF88]/10 border-[#39FF88]/20', single: 'text-blue-400 bg-blue-400/10 border-blue-400/20', clear_all: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
    return map[mode] || 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filtered = sessions.filter(s => {
    const matchSearch = !search || s.player_name?.toLowerCase().includes(search.toLowerCase()) || s.equipment_name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || s.mode === filter;
    return matchSearch && matchFilter;
  });

  const totalHits = sessions.reduce((a, s) => a + (s.hits || 0), 0);
  const avgAccuracy = sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.accuracy || 0), 0) / sessions.length) : 0;
  const totalScore = sessions.reduce((a, s) => a + (s.score || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-amber-400 tracking-wide">SESSÕES</h1>
        <p className="text-[#8C9891] text-sm mt-1">Histórico de todas as sessões de treino</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Sessões', value: sessions.length, icon: Activity, color: 'text-amber-400' },
          { label: 'Total Acertos', value: totalHits, icon: Zap, color: 'text-[#39FF88]' },
          { label: 'Precisão Média', value: `${avgAccuracy}%`, icon: Filter, color: 'text-blue-400' },
          { label: 'XP Total', value: totalScore.toLocaleString('pt-BR'), icon: Clock, color: 'text-purple-400' },
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C9891]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por jogador ou equipamento..."
            className="w-full bg-[#0C1A11] border border-[#1B3624] rounded-xl pl-9 pr-4 py-2.5 text-[#F5F7F5] text-sm placeholder-[#8C9891] focus:outline-none focus:border-amber-400/50"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-[#0C1A11] border border-[#1B3624] rounded-xl px-4 py-2.5 text-[#F5F7F5] text-sm focus:outline-none focus:border-amber-400/50"
        >
          <option value="all">Todos os Modos</option>
          <option value="free">Treino Livre</option>
          <option value="single">Alvo Único</option>
          <option value="clear_all">Apague Todos</option>
        </select>
      </div>

      {/* Sessions Table */}
      <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#8C9891]">Carregando sessões...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[#8C9891]">Nenhuma sessão encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1B3624]">
                  {['#', 'Jogador', 'Equipamento', 'Modo', 'Acertos', 'Precisão', 'XP', 'Data'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[#8C9891] font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-[#1B3624]/50 hover:bg-[#1B3624]/20 transition-colors ${i % 2 === 0 ? '' : 'bg-[#07110B]/30'}`}>
                    <td className="px-4 py-3 text-[#8C9891] font-mono">{s.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 text-xs font-bold">
                          {(s.player_name || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-[#F5F7F5] font-medium">{s.player_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#8C9891]">{s.equipment_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${modeColor(s.mode)}`}>
                        {modeLabel(s.mode)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#F5F7F5] font-bold">{s.hits ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${(s.accuracy || 0) >= 80 ? 'text-[#39FF88]' : (s.accuracy || 0) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                        {s.accuracy != null ? `${s.accuracy}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#F5F7F5] font-mono">{s.score?.toLocaleString('pt-BR') ?? '—'}</td>
                    <td className="px-4 py-3 text-[#8C9891] text-xs">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
