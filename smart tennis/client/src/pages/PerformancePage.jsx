import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Crosshair, 
  Zap, 
  Activity, 
  Layers, 
  Compass,
  ArrowDownRight,
  Filter
} from 'lucide-react';
import CourtTarget from '../components/CourtTarget';
import { api } from '../services/api';

export default function PerformancePage() {
  const [data, setData] = useState({ shots: [], zoneDistribution: {}, totalCount: 0, totalHits: 0, bullseyes: 0 });
  const [filter, setFilter] = useState('all'); // all, bullseye, hits, misses
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    try {
      const res = await api.getHitMapData();
      setData(res || { shots: [], zoneDistribution: {} });
    } catch (e) {
      console.error('Erro ao carregar dados de desempenho:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredShots = (data.shots || []).filter((s) => {
    if (filter === 'bullseye') return s.is_bullseye === 1;
    if (filter === 'hits') return s.is_hit === 1;
    if (filter === 'misses') return s.is_hit === 0;
    return true;
  });

  const precisionRate = data.totalCount > 0 ? Math.round((data.totalHits / data.totalCount) * 100) : 0;
  const bullseyeRate = data.totalCount > 0 ? Math.round((data.bullseyes / data.totalCount) * 100) : 0;

  // Sorted zone distribution
  const sortedZones = Object.entries(data.zoneDistribution || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5] flex items-center space-x-2">
            <BarChart2 className="w-6 h-6 text-[#39FF88]" />
            <span>Meu Desempenho & Mapa de Acertos</span>
          </h1>
          <p className="text-xs text-[#8C9891] mt-1">
            Análise biomecânica e espacial de impactos para correção técnica de mira e trajetória.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center space-x-2 bg-[#07110B] p-1 rounded-xl border border-[#1B3624] text-xs font-mono">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'all' ? 'bg-[#39FF88] text-[#07110B] font-bold' : 'text-[#8C9891] hover:text-[#F5F7F5]'
            }`}
          >
            Todos ({data.totalCount})
          </button>
          <button
            onClick={() => setFilter('bullseye')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'bullseye' ? 'bg-[#39FF88] text-[#07110B] font-bold' : 'text-[#8C9891] hover:text-[#F5F7F5]'
            }`}
          >
            Na Mosca ({data.bullseyes})
          </button>
          <button
            onClick={() => setFilter('hits')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'hits' ? 'bg-[#39FF88] text-[#07110B] font-bold' : 'text-[#8C9891] hover:text-[#F5F7F5]'
            }`}
          >
            Acertos ({data.totalHits})
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
          <span className="text-xs font-mono text-[#8C9891]">TAXA DE PRECISÃO GLOBAL</span>
          <div className="text-3xl font-black font-mono text-[#39FF88] mt-1">{precisionRate}%</div>
          <div className="text-[11px] text-[#8C9891] mt-1">{data.totalHits} acertos em {data.totalCount} jogadas</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
          <span className="text-xs font-mono text-[#8C9891]">ÍNDICE "NA MOSCA" (BULLSEYE)</span>
          <div className="text-3xl font-black font-mono text-[#F5F7F5] mt-1">{bullseyeRate}%</div>
          <div className="text-[11px] text-[#8C9891] mt-1">{data.bullseyes} impactos no centro absoluto</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
          <span className="text-xs font-mono text-[#8C9891]">REGIONALIZAÇÃO MAIS FREQUENTE</span>
          <div className="text-2xl font-black text-[#39FF88] truncate mt-1">
            {sortedZones[0]?.[0] || 'Centro'}
          </div>
          <div className="text-[11px] text-[#8C9891] mt-1">{sortedZones[0]?.[1] || 0} jogadas registradas</div>
        </div>
      </div>

      {/* Main Grid: Full Hit Map + Zone Distribution List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Hit Map Canvas */}
        <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F5F7F5] flex items-center space-x-2">
              <Crosshair className="w-5 h-5 text-[#39FF88]" />
              <span>Mapa Espacial de Impactos (X, Y)</span>
            </h2>
            <span className="text-xs font-mono text-[#8C9891]">
              Exibindo {filteredShots.length} registros
            </span>
          </div>

          <div className="py-2">
            <CourtTarget
              interactive={false}
              showHeatmap={true}
              shots={filteredShots}
            />
          </div>

          <div className="p-4 rounded-xl bg-[#07110B] border border-[#1B3624] text-xs font-mono text-[#8C9891] space-y-1">
            <div className="text-[#39FF88] font-bold">INTEGRAÇÃO COM HARDWARE:</div>
            <div>
              Coordenadas recebidas via <code className="text-[#F5F7F5]">POST /api/hardware/hit</code> mapeadas diretamente na matriz de impacto 0-100.
            </div>
          </div>
        </div>

        {/* Zone Distribution Breakdown */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-4">
          <h2 className="text-base font-bold text-[#F5F7F5] flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#39FF88]" />
            <span>Densidade por Região do Alvo</span>
          </h2>
          <p className="text-xs text-[#8C9891]">
            Frequência de acertos nas 9 zonas dos sensores:
          </p>

          <div className="space-y-3 pt-2">
            {sortedZones.map(([zoneName, count], idx) => {
              const pct = data.totalCount > 0 ? Math.round((count / data.totalCount) * 100) : 0;
              return (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#F5F7F5]">{zoneName}</span>
                    <span className="font-mono text-[#39FF88] font-bold">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#07110B] border border-[#1B3624] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#16C96B] to-[#39FF88] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
