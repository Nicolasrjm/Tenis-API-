import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  Target, 
  Flame, 
  BarChart2, 
  GitFork, 
  Clock, 
  Zap, 
  Radio, 
  ArrowRight 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = async () => {
    try {
      const data = await api.getPlayer();
      setPlayer(data);
    } catch (e) {
      console.error('Erro ao carregar atleta:', e);
    } finally {
      setLoading(false);
    }
  };

  const xpPercent = player ? Math.min(100, Math.round((player.xp / player.xp_next) * 100)) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fadeIn">
      
      {/* 23. CABEÇALHO LIMPO DO JOGADOR (Requirement 23) */}
      <div className="p-8 rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] space-y-6 shadow-2xl relative overflow-hidden">
        
        {/* Glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#39FF88]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold tracking-widest text-[#39FF88] uppercase">
              BEM-VINDO DE VOLTA
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-[#F5F7F5] uppercase tracking-tight">
              OLÁ, {user?.name || player?.name || 'NICOLAS'}
            </h1>
            <div className="flex items-center space-x-2 pt-1 font-mono">
              <span className="text-sm font-bold text-[#39FF88] bg-[#39FF88]/15 px-2.5 py-0.5 rounded border border-[#39FF88]/40">
                LV. {player?.level || 12} — {player?.title || 'COMPETIDOR'}
              </span>
              <span className="text-xs text-[#8C9891]">
                • Equipamento {user?.equipment?.name || 'Motion Tennis #001'}
              </span>
            </div>
          </div>

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#102216] border-2 border-[#39FF88] flex items-center justify-center text-3xl sm:text-4xl shadow-neon">
            {user?.avatar || player?.avatar || '🎾'}
          </div>
        </div>

        {/* Barra de XP */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#8C9891] font-bold">PROGRESSO DE EXPERIÊNCIA</span>
            <span className="text-[#39FF88] font-bold">
              {player?.xp || 2450} / {player?.xp_next || 3000} XP ({xpPercent}%)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-[#07110B] border border-[#1B3624] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#16C96B] to-[#39FF88] rounded-full transition-all duration-700 shadow-neon-sm"
              style={{ width: `${xpPercent}%` }}
            ></div>
          </div>
        </div>

        {/* 3 Métricas Centrais */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1B3624] font-mono text-center">
          <div className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624]">
            <span className="text-[11px] text-[#8C9891] block uppercase">Precisão</span>
            <span className="text-2xl sm:text-3xl font-black text-[#39FF88] mt-1 block">
              {player?.precision || 82}%
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624]">
            <span className="text-[11px] text-[#8C9891] block uppercase">Treinos</span>
            <span className="text-2xl sm:text-3xl font-black text-[#F5F7F5] mt-1 block">
              {player?.trainings_completed || 24}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624]">
            <span className="text-[11px] text-[#8C9891] block uppercase">Sequência</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 block">
              {player?.streak_days || 5} dias
            </span>
          </div>
        </div>

      </div>

      {/* CONTINUAR TREINANDO — 3 BOTÕES PRINCIPAIS DE JOGO (Requirement 23) */}
      <div className="space-y-4">
        <h2 className="text-sm font-mono font-bold tracking-widest text-[#39FF88] uppercase">
          CONTINUAR TREINANDO
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Treino Livre */}
          <Link
            to="/app/play?mode=free"
            className="p-6 rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] hover:border-[#39FF88] transition-all hover:-translate-y-1 group shadow-sm hover:shadow-neon"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88] mb-4 group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors">
              TREINO LIVRE
            </h3>
            <p className="text-xs text-[#8C9891] mt-1.5 leading-relaxed">
              Realize jogadas sem objetivo específico. Todos os sensores medem seus acertos.
            </p>
          </Link>

          {/* Alvo Único */}
          <Link
            to="/app/play?mode=single"
            className="p-6 rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] hover:border-[#39FF88] transition-all hover:-translate-y-1 group shadow-sm hover:shadow-neon"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88] mb-4 group-hover:scale-110 transition-transform">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors">
              ALVO ÚNICO
            </h3>
            <p className="text-xs text-[#8C9891] mt-1.5 leading-relaxed">
              Acerte o sensor iluminado em tempo hábil para alternar para o próximo alvo.
            </p>
          </Link>

          {/* Apague Todos */}
          <Link
            to="/app/play?mode=clear_all"
            className="p-6 rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] hover:border-[#39FF88] transition-all hover:-translate-y-1 group shadow-sm hover:shadow-neon"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88] mb-4 group-hover:scale-110 transition-transform">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors">
              APAGUE TODOS
            </h3>
            <p className="text-xs text-[#8C9891] mt-1.5 leading-relaxed">
              Desligue todos os sensores. Se acertar um sensor já desligado, ele religa!
            </p>
          </Link>

        </div>
      </div>

      {/* LINKS RÁPIDOS PARA ESTATÍSTICAS, EVOLUÇÃO E HISTÓRICO (Requirement 23) */}
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-4">
        <h3 className="text-xs font-mono font-bold tracking-widest text-[#8C9891] uppercase">
          ÁREAS DE ACOMPANHAMENTO DO ATLETA
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <Link
            to="/app/statistics"
            className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88]/50 flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <BarChart2 className="w-5 h-5 text-[#39FF88]" />
              <div>
                <h4 className="text-xs font-bold text-[#F5F7F5] group-hover:text-[#39FF88]">Estatísticas</h4>
                <span className="text-[10px] text-[#8C9891]">6 Atributos & Dicas</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#8C9891] group-hover:text-[#39FF88] group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to="/app/evolution"
            className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88]/50 flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <GitFork className="w-5 h-5 text-[#39FF88]" />
              <div>
                <h4 className="text-xs font-bold text-[#F5F7F5] group-hover:text-[#39FF88]">Evolução</h4>
                <span className="text-[10px] text-[#8C9891]">Skill Tree do Atleta</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#8C9891] group-hover:text-[#39FF88] group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to="/app/history"
            className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88]/50 flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-[#39FF88]" />
              <div>
                <h4 className="text-xs font-bold text-[#F5F7F5] group-hover:text-[#39FF88]">Histórico</h4>
                <span className="text-[10px] text-[#8C9891]">Sessões Anteriores</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#8C9891] group-hover:text-[#39FF88] group-hover:translate-x-0.5 transition-transform" />
          </Link>

        </div>
      </div>

    </div>
  );
}
