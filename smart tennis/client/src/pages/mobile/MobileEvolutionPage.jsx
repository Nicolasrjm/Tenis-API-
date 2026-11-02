import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Target,
  Trophy,
  Zap,
  Calendar,
  Layers,
  Activity,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import MobileVisitorGuard from '../../components/mobile/MobileVisitorGuard';

export default function MobileEvolutionPage() {
  const { isGuest } = useAuth();

  const [period, setPeriod] = useState('all'); // '7d' | '30d' | 'all'
  const [sessions, setSessions] = useState([]);
  const [hitmapData, setHitmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    loadData();
  }, [isGuest]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessData, hitmap] = await Promise.all([
        api.getSessions(50).catch(() => []),
        api.getHitmap().catch(() => null)
      ]);
      setSessions(Array.isArray(sessData) ? sessData : []);
      setHitmapData(hitmap);
    } catch (err) {
      setError(err.message || 'Falha ao carregar dados de evolução');
    } finally {
      setLoading(false);
    }
  };

  if (isGuest) {
    return <MobileVisitorGuard featureName="a Evolução e Estatísticas" />;
  }

  // Filter sessions by period
  const now = Date.now();
  const filteredSessions = sessions.filter((s) => {
    if (!s.created_at) return true;
    const sessionTime = new Date(s.created_at).getTime();
    if (period === '7d') {
      return now - sessionTime <= 7 * 24 * 60 * 60 * 1000;
    }
    if (period === '30d') {
      return now - sessionTime <= 30 * 24 * 60 * 60 * 1000;
    }
    return true;
  });

  // Sort chronological for charts
  const chronologicalSessions = [...filteredSessions].sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tA - tB;
  });

  // Calculate Mode Comparisons
  const modeStats = {
    'Treino Livre': { count: 0, bestScore: 0, totalHits: 0 },
    'Liga um por vez': { count: 0, bestScore: 0, totalHits: 0 },
    'Apagar todos': { count: 0, bestScore: 0, totalHits: 0 }
  };

  filteredSessions.forEach((s) => {
    const rawMode = s.mode || 'Treino Livre';
    let key = 'Treino Livre';
    if (rawMode.toLowerCase().includes('liga')) key = 'Liga um por vez';
    else if (rawMode.toLowerCase().includes('apagar')) key = 'Apagar todos';

    modeStats[key].count++;
    modeStats[key].bestScore = Math.max(modeStats[key].bestScore, s.total_score || 0);
    modeStats[key].totalHits += s.hits_count || 0;
  });

  // 6 Sectors distribution
  const zoneDistribution = hitmapData?.zoneDistribution || {};
  const totalZoneHits = Object.values(zoneDistribution).reduce((a, b) => a + b, 0) || 1;

  // Simple SVG Line Chart generator
  const renderLineChart = (dataPoints, color = '#39FF88', unit = 'pts') => {
    if (!dataPoints || dataPoints.length === 0) {
      return (
        <div className="h-40 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-[#08120B] border border-[#142A1B] text-xs text-[#8C9891]">
          <Activity className="w-6 h-6 mb-2 opacity-30 text-[#39FF88]" />
          <span>Sem partidas registradas no período selecionado.</span>
        </div>
      );
    }

    if (dataPoints.length === 1) {
      return (
        <div className="h-40 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-[#08120B] border border-[#142A1B]">
          <span className="text-3xl font-black font-mono text-[#39FF88]">
            {dataPoints[0]} {unit}
          </span>
          <span className="text-xs text-[#8C9891] mt-1">1 partida registrada no período</span>
        </div>
      );
    }

    const min = 0;
    const max = Math.max(...dataPoints, 10);
    const width = 320;
    const height = 130;
    const padding = 15;

    const points = dataPoints.map((val, idx) => {
      const x = padding + (idx / (dataPoints.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - min) / (max - min)) * (height - 2 * padding);
      return { x, y, val };
    });

    const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div className="p-4 rounded-2xl bg-[#08120B] border border-[#142A1B] space-y-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1A3423" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1A3423" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1A3423" />

          {/* Area under curve */}
          <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />

          {/* Curve line */}
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Point circles */}
          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="3.5"
              fill="#060D09"
              stroke={color}
              strokeWidth="2"
            />
          ))}
        </svg>

        <div className="flex items-center justify-between text-[10px] font-mono text-[#8C9891] pt-1">
          <span>Início do período</span>
          <span>Mais recente: <strong className="text-white">{dataPoints[dataPoints.length - 1]} {unit}</strong></span>
        </div>
      </div>
    );
  };

  const scoresList = chronologicalSessions.map((s) => s.total_score || 0);
  const accuracyList = chronologicalSessions
    .filter((s) => s.accuracy !== null && s.accuracy !== undefined)
    .map((s) => s.accuracy);

  return (
    <div className="p-4 sm:p-5 space-y-5 animate-fadeIn">
      
      {/* Top Title & Period Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-[#39FF88]" />
              <span>Evolução & Estatísticas</span>
            </h1>
            <p className="text-xs text-[#8C9891]">
              Desempenho histórico e precisão por setor
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-[#0D1E13] border border-[#163020] text-[#8C9891] hover:text-[#39FF88] transition"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#39FF88]' : ''}`} />
          </button>
        </div>

        {/* Period Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[#09150E] border border-[#142A1B]">
          <button
            onClick={() => setPeriod('7d')}
            data-testid="filter-period-7d"
            className={`py-1.5 rounded-lg text-xs font-bold transition ${
              period === '7d'
                ? 'bg-[#14301D] text-[#39FF88] shadow-sm'
                : 'text-[#8C9891] hover:text-white'
            }`}
          >
            7 Dias
          </button>
          <button
            onClick={() => setPeriod('30d')}
            data-testid="filter-period-30d"
            className={`py-1.5 rounded-lg text-xs font-bold transition ${
              period === '30d'
                ? 'bg-[#14301D] text-[#39FF88] shadow-sm'
                : 'text-[#8C9891] hover:text-white'
            }`}
          >
            30 Dias
          </button>
          <button
            onClick={() => setPeriod('all')}
            data-testid="filter-period-all"
            className={`py-1.5 rounded-lg text-xs font-bold transition ${
              period === 'all'
                ? 'bg-[#14301D] text-[#39FF88] shadow-sm'
                : 'text-[#8C9891] hover:text-white'
            }`}
          >
            Geral
          </button>
        </div>
      </div>

      {/* Loading & Error */}
      {loading && (
        <div className="py-8 text-center text-xs text-[#8C9891]">
          <RefreshCw className="w-6 h-6 text-[#39FF88] animate-spin mx-auto mb-2" />
          <span>Calculando métricas esportivas...</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* 1. Score Evolution Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-[#39FF88]" />
            <span>Evolução da Pontuação</span>
          </h2>
          <span className="text-[10px] font-mono text-[#8C9891]">
            {scoresList.length} partidas
          </span>
        </div>
        {renderLineChart(scoresList, '#39FF88', 'pts')}
      </div>

      {/* 2. Accuracy Evolution Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span>Curva de Precisão (%)</span>
          </h2>
          <span className="text-[10px] font-mono text-[#8C9891]">
            {accuracyList.length} sessões
          </span>
        </div>
        {renderLineChart(accuracyList, '#34D399', '%')}
      </div>

      {/* 3. 6 Sectors Wall Distribution */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-[#39FF88]" />
            <span>Distribuição de Impactos (6 Alvos)</span>
          </h2>
          <span className="text-[10px] font-mono text-[#8C9891]">
            Alvos Físicos 1 a 6
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#08120B] border border-[#142A1B] space-y-3">
          {/* 2x3 Grid matching wall sectors */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((zoneId) => {
              const count = zoneDistribution[zoneId] || 0;
              const pct = Math.round((count / totalZoneHits) * 100);
              return (
                <div
                  key={zoneId}
                  className="p-3 rounded-xl bg-[#0A1810] border border-[#183722] flex flex-col items-center justify-center text-center space-y-1 hover:border-[#39FF88]/40 transition"
                >
                  <span className="text-[10px] font-mono text-[#8C9891]">Alvo {zoneId}</span>
                  <span className="text-base font-black font-mono text-[#39FF88]">{pct}%</span>
                  <span className="text-[9px] text-[#6F8176]">{count} golpes</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[#6F8176] text-center font-mono">
            Matriz correspondente à parede de alvos calibrada (Alvos 1-3 superiores, 4-6 inferiores).
          </p>
        </div>
      </div>

      {/* 4. Comparison by Game Mode */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Comparação Entre Modos de Jogo</span>
        </h2>

        <div className="grid grid-cols-3 gap-2">
          {Object.entries(modeStats).map(([modeName, st]) => (
            <div
              key={modeName}
              className="p-3 rounded-2xl bg-[#0A140E] border border-[#163020] space-y-1 text-center"
            >
              <span className="text-[10px] font-bold text-white block truncate leading-tight">
                {modeName}
              </span>
              <div className="text-base font-black font-mono text-[#39FF88]">
                {st.count}
              </div>
              <span className="text-[9px] text-[#8C9891] block">partidas</span>
              <div className="pt-1 border-t border-white/5 text-[10px] font-mono text-amber-300">
                Top: {st.bestScore}p
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
