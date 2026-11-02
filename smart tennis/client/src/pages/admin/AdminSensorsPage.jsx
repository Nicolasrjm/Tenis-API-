import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Target, Activity, RefreshCw, Radio } from 'lucide-react';
import { api } from '../../services/api';
import IotDiagnosticPanel from '../../components/IotDiagnosticPanel';

const SECTOR_POSITIONS = [
  { id: 1, label: 'Setor 1 (Superior Esquerdo)', zone: 'top_left', x: 20, y: 27 },
  { id: 2, label: 'Setor 2 (Superior Central)',  zone: 'top_center', x: 50, y: 27 },
  { id: 3, label: 'Setor 3 (Superior Direito)',  zone: 'top_right', x: 80, y: 27 },
  { id: 4, label: 'Setor 4 (Inferior Esquerdo)', zone: 'bottom_left', x: 20, y: 73 },
  { id: 5, label: 'Setor 5 (Inferior Central)',  zone: 'bottom_center', x: 50, y: 73 },
  { id: 6, label: 'Setor 6 (Inferior Direito)',  zone: 'bottom_right', x: 80, y: 73 }
];

const KY037_CORNERS = [
  { id: 'S1', corner: 'Canto Superior Esquerdo', formula: '(0, H)', screenX: 4, screenY: 6 },
  { id: 'S2', corner: 'Canto Superior Direito',  formula: '(L, H)', screenX: 96, screenY: 6 },
  { id: 'S3', corner: 'Canto Inferior Esquerdo', formula: '(0, 0)', screenX: 4, screenY: 94 }
];

export default function AdminSensorsPage() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadSensors();
  }, []);

  const loadSensors = async () => {
    try {
      const res = await api.getSensors();
      const merged = SECTOR_POSITIONS.map(pos => {
        const db = (res || []).find(s => s.id === pos.id || s.sensor_index === pos.id);
        return { ...pos, hits: db?.total_hits || 0, status: db?.status || 'online', last_hit: db?.last_hit };
      });
      setSensors(merged);
    } catch (e) {
      console.error('Erro ao carregar sensores:', e);
      setSensors(SECTOR_POSITIONS.map(p => ({ ...p, hits: 0, status: 'online', last_hit: null })));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSensors();
    setRefreshing(false);
  };

  const maxHits = Math.max(...sensors.map(s => s.hits), 1);
  const totalHits = sensors.reduce((a, s) => a + s.hits, 0);
  const onlineCount = sensors.filter(s => s.status === 'online').length;

  const sensorColor = (sensor) => {
    if (sensor.zone === 'center') return '#39FF88';
    const ratio = sensor.hits / maxHits;
    if (ratio > 0.7) return '#16C96B';
    if (ratio > 0.4) return '#8C9891';
    return '#1B3624';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-amber-400 tracking-wide">ALVOS E SENSORES</h1>
          <p className="text-[#8C9891] text-sm mt-1">Monitoramento dos 6 alvos físicos fixos</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-[#0C1A11] border border-[#1B3624] hover:border-amber-400/50 text-[#8C9891] hover:text-amber-400 px-4 py-2 rounded-xl text-sm transition-all"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Alvos Online', value: `${onlineCount}/6`, icon: Wifi, color: 'text-[#39FF88]' },
          { label: 'Alvos Offline', value: `${6 - onlineCount}/6`, icon: WifiOff, color: 'text-red-400' },
          { label: 'Total Acertos', value: totalHits, icon: Target, color: 'text-amber-400' },
          { label: 'Média/Alvo', value: Math.round(totalHits / 6), icon: Activity, color: 'text-blue-400' },
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
        {/* Visual Map */}
        <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-[#8C9891] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Target size={14} />
            Mapa Físico: 3 Sensores KY-037 nos Cantos + 6 Setores
          </h2>
          <div className="relative aspect-[3/2] max-w-md mx-auto">
            {/* Background grid */}
            <div className="absolute inset-0 rounded-2xl border-2 border-[#1B3624] bg-[#07110B]">
              {/* Crosshair lines */}
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-[#1B3624]/50" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-[#1B3624]/50" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-[#1B3624]/50" />
            </div>

            {/* 3 Sensores Acústicos KY-037 nos Cantos */}
            {KY037_CORNERS.map((s) => (
              <div
                key={s.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400 text-[10px] font-mono font-bold text-cyan-300 shadow"
                style={{ left: `${s.screenX}%`, top: `${s.screenY}%` }}
                title={`${s.id}: ${s.corner} ${s.formula}`}
              >
                {s.id} {s.formula}
              </div>
            ))}

            {/* Indicador explícito do canto inferior direito sem sensor */}
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 px-1.5 py-0.5 rounded bg-[#08120B]/80 border border-[#1B3624] text-[9px] font-mono text-[#8C9891]/60"
              style={{ left: '92%', top: '94%' }}
            >
              Sem sensor
            </div>

            {/* 6 Setores */}
            {sensors.map(sensor => (
              <button
                key={sensor.id}
                onClick={() => setSelected(sensor)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110 z-10"
                style={{ left: `${sensor.x}%`, top: `${sensor.y}%` }}
              >
                <div
                  className="w-9 h-9 rounded-xl border-2 flex items-center justify-center text-xs font-black transition-all"
                  style={{
                    backgroundColor: `${sensorColor(sensor)}20`,
                    borderColor: selected?.id === sensor.id ? '#39FF88' : sensorColor(sensor),
                    color: sensorColor(sensor),
                    boxShadow: selected?.id === sensor.id ? `0 0 12px ${sensorColor(sensor)}80` : 'none'
                  }}
                >
                  S{sensor.id}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-[#8C9891] text-center mt-4">
            Sensores KY-037: S1 (sup. esq.), S2 (sup. dir.), S3 (inf. esq. — origem 0,0). Canto inferior direito não possui sensor.
          </p>
        </div>

        {/* Sensor Details / List */}
        <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-6">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-[#8C9891] uppercase tracking-wider">Sensor #{selected.id}</h2>
                <button onClick={() => setSelected(null)} className="text-[#8C9891] hover:text-[#F5F7F5] text-xs">← Voltar</button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-[#8C9891] text-xs uppercase tracking-wider mb-1">Posição</div>
                  <div className="text-[#F5F7F5] font-bold">{selected.label}</div>
                </div>
                <div>
                  <div className="text-[#8C9891] text-xs uppercase tracking-wider mb-1">Status</div>
                  <div className={`flex items-center gap-2 font-bold ${selected.status === 'online' ? 'text-[#39FF88]' : 'text-red-400'}`}>
                    {selected.status === 'online' ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {selected.status === 'online' ? 'Online' : 'Offline'}
                  </div>
                </div>
                <div>
                  <div className="text-[#8C9891] text-xs uppercase tracking-wider mb-1">Total de Acertos</div>
                  <div className="text-3xl font-black text-amber-400">{selected.hits}</div>
                </div>
                <div>
                  <div className="text-[#8C9891] text-xs uppercase tracking-wider mb-2">Uso Relativo</div>
                  <div className="h-2 bg-[#1B3624] rounded-full overflow-hidden">
                    <div className="h-full bg-[#39FF88] rounded-full transition-all" style={{ width: `${(selected.hits / maxHits) * 100}%` }} />
                  </div>
                  <div className="text-xs text-[#8C9891] mt-1">{Math.round((selected.hits / maxHits) * 100)}% do sensor mais ativo</div>
                </div>
                {selected.zone === 'center' && (
                  <div className="flex items-center gap-2 bg-[#39FF88]/5 border border-[#39FF88]/20 rounded-xl p-3 text-xs text-[#39FF88]">
                    <Target size={12} />
                    Bullseye — Região de maior precisão
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-bold text-[#8C9891] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity size={14} />
                Lista de Sensores
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {sensors.map(sensor => (
                  <button
                    key={sensor.id}
                    onClick={() => setSelected(sensor)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#1B3624]/30 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{ borderColor: sensorColor(sensor), color: sensorColor(sensor), backgroundColor: `${sensorColor(sensor)}15` }}>
                      {sensor.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#F5F7F5] text-sm font-medium truncate">{sensor.label}</div>
                      <div className="h-1 bg-[#1B3624] rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(sensor.hits / maxHits) * 100}%`, backgroundColor: sensorColor(sensor) }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[#F5F7F5] font-bold text-sm">{sensor.hits}</div>
                      <div className="text-[#8C9891] text-xs">acertos</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel de Diagnóstico IoT Completo */}
      <IotDiagnosticPanel />
    </div>
  );
}
