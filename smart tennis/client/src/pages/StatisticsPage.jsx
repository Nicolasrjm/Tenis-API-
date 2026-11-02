import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  Target, 
  Activity, 
  Zap, 
  Shield, 
  Sparkles, 
  Compass, 
  ArrowRight, 
  GraduationCap,
  TrendingUp
} from 'lucide-react';
import { api } from '../services/api';

export default function StatisticsPage() {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadAttributes();
  }, []);

  const loadAttributes = async () => {
    try {
      const data = await api.getAttributes();
      setAttributes(data || []);
    } catch (e) {
      console.error('Erro ao carregar estatísticas:', e);
    } finally {
      setLoading(false);
    }
  };

  const attributeIcons = {
    precision: Target,
    consistency: Activity,
    speed: Zap,
    control: Shield,
    reflex: Sparkles,
    strategy: Compass
  };

  const attributeInterpretations = {
    precision: 'Capacidade de direcionar a bola aos sensores periféricos e acertar o centro.',
    consistency: 'Manutenção de ritmo motor sem oscilação técnica ao longo de longos rallies.',
    speed: 'Aceleração do golpe e potência medida em km/h no momento do contato.',
    control: 'Sensibilidade de raquete para alternar profundidade e amortecimentos precisos.',
    reflex: 'Velocidade de reação e leitura visual em situações de alta pressão temporal.',
    strategy: 'Tomada de decisão tática e construção de pontos explorando áreas vazias.'
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fadeIn">
      
      {/* 16. ESTATÍSTICAS SEPARADAS */}
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5] flex items-center space-x-2">
            <BarChart2 className="w-6 h-6 text-[#39FF88]" />
            <span>Estatísticas & Habilidades do Atleta</span>
          </h1>
          <p className="text-xs text-[#8C9891] mt-1">
            Métricas de desempenho calculadas com base nos impactos registrados no equipamento Motion Tennis.
          </p>
        </div>

        {/* Link para a Academy */}
        <button
          onClick={() => navigate('/app/academy')}
          className="px-4 py-2.5 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] hover:bg-[#39FF88]/15 text-xs font-mono font-bold flex items-center space-x-2 transition-all"
        >
          <GraduationCap className="w-4 h-4" />
          <span>Ver Motion Tennis Academy</span>
        </button>
      </div>

      {/* Grid de 6 Atributos com o Botão "COMO MELHORAR" (Requirement 17) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {attributes.map((attr) => {
          const Icon = attributeIcons[attr.key] || Target;
          const pct = Math.min(100, Math.round((attr.xp / attr.xp_next) * 100));

          return (
            <div
              key={attr.key}
              className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex flex-col justify-between space-y-4 hover:border-[#39FF88]/40 transition-all shadow-sm"
            >
              <div className="space-y-3">
                
                {/* Header do Card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-[#F5F7F5] uppercase">
                        {attr.name}
                      </h3>
                      <span className="text-xs font-mono font-bold text-[#39FF88]">
                        LV. {attr.level} / {attr.max_level}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-[#8C9891]">
                    {attr.xp} / {attr.xp_next} XP
                  </span>
                </div>

                {/* Barra de Progresso */}
                <div className="w-full h-2 rounded-full bg-[#07110B] border border-[#1B3624] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#16C96B] to-[#39FF88] rounded-full transition-all duration-500 shadow-neon-sm"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>

                {/* Breve Interpretação */}
                <p className="text-xs text-[#8C9891] leading-relaxed">
                  {attributeInterpretations[attr.key] || attr.objective}
                </p>

                {/* Pontos fortes e a melhorar resumidos */}
                <div className="p-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-[11px] font-mono text-[#8C9891] space-y-1">
                  <div>
                    <span className="text-[#39FF88] font-bold">Foco: </span>
                    {attr.objective || 'Manter regularidade nas séries de treino.'}
                  </div>
                </div>

              </div>

              {/* 17. NOVO FLUXO: COMO MELHORAR -> LEVA PARA /app/academy/:skill (NÃO LEVA PARA /app/play!) */}
              <div className="pt-2">
                <button
                  onClick={() => navigate(`/app/academy/${attr.key}`)}
                  className="w-full py-3 px-4 rounded-xl bg-[#102216] border border-[#39FF88]/50 text-[#39FF88] hover:bg-[#39FF88] hover:text-[#07110B] text-xs font-mono font-bold tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-sm"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>COMO MELHORAR</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
