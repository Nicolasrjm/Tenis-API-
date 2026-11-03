import React, { useState, useEffect } from 'react';
import { 
  User, 
  Save, 
  RotateCcw, 
  Trash2, 
  Trophy, 
  Calendar, 
  Target, 
  Flame, 
  Award,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import CloudLinkCard from '../components/CloudLinkCard';

export default function ProfilePage({ player: propPlayer, onPlayerUpdate }) {
  const [playerData, setPlayerData] = useState(propPlayer || null);
  const [name, setName] = useState(propPlayer?.name || 'Nicolas');
  const [avatar, setAvatar] = useState(propPlayer?.avatar || '🎾');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!propPlayer?.level);
  const [message, setMessage] = useState(null);

  const availableAvatars = ['🎾', '⚡', '🏆', '🎯', '🚀', '🔥', '👑', '🥇'];

  useEffect(() => {
    loadFullProfile();
  }, []);

  const loadFullProfile = async () => {
    try {
      setLoading(true);
      const data = await api.getPlayer();
      if (data) {
        setPlayerData(data);
        if (data.name) setName(data.name);
        if (data.avatar) setAvatar(data.avatar);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do atleta:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updatePlayer({ name, avatar });
      setPlayerData((prev) => ({ ...prev, ...updated }));
      if (onPlayerUpdate) onPlayerUpdate(updated);
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar perfil' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemo = async () => {
    if (window.confirm('Deseja restaurar os dados originais de demonstração de Nicolas (LV 12, 24 treinos, etc)?')) {
      try {
        const res = await api.resetDemoData();
        setPlayerData(res.player);
        if (onPlayerUpdate) onPlayerUpdate(res.player);
        setName(res.player.name);
        setAvatar(res.player.avatar);
        setMessage({ type: 'success', text: 'Dados de demonstração restaurados com sucesso!' });
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      }
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Tem certeza de que deseja limpar todos os registros e iniciar um novo jogador do nível 1?')) {
      try {
        const res = await api.clearData();
        setPlayerData(res.player);
        if (onPlayerUpdate) onPlayerUpdate(res.player);
        setName(res.player.name);
        setAvatar(res.player.avatar);
        setMessage({ type: 'success', text: 'Dados limpos! Novo perfil iniciado no nível 1.' });
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      }
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex items-center space-x-3">
        <User className="w-6 h-6 text-[#39FF88]" />
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5]">Perfil do Jogador</h1>
          <p className="text-xs text-[#8C9891]">Gerencie seu cadastro, avatar e configurações de dados esportivos.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs font-mono border ${
          message.type === 'success'
            ? 'bg-[#102216] border-[#39FF88] text-[#39FF88]'
            : 'bg-rose-950/40 border-rose-500 text-rose-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Main Profile Form */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Avatar selector */}
          <div>
            <label className="block text-xs font-mono text-[#8C9891] mb-2 uppercase">
              Escolha seu Avatar Esportivo
            </label>
            <div className="flex flex-wrap gap-3">
              {availableAvatars.map((av) => (
                <button
                  type="button"
                  key={av}
                  onClick={() => setAvatar(av)}
                  className={`w-12 h-12 rounded-2xl text-xl flex items-center justify-center transition-all ${
                    avatar === av
                      ? 'bg-[#102216] border-2 border-[#39FF88] shadow-neon scale-105'
                      : 'bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88]/40'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Player Name */}
          <div>
            <label className="block text-xs font-mono text-[#8C9891] mb-2 uppercase">
              Nome do Jogador
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] font-bold focus:border-[#39FF88] focus:outline-none transition-colors"
              placeholder="Digite seu nome"
              required
            />
          </div>

          {/* Stats Summary Grid (Requirement 19) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#07110B] border border-[#1B3624]">
              <span className="text-[10px] font-mono text-[#8C9891]">NÍVEL ATUAL</span>
              <div className="text-lg font-black text-[#39FF88]">
                {loading ? '...' : `LV. ${playerData?.level ?? 1}`}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#07110B] border border-[#1B3624]">
              <span className="text-[10px] font-mono text-[#8C9891]">EXPERIÊNCIA</span>
              <div className="text-lg font-black text-[#F5F7F5]">
                {loading ? '...' : `${playerData?.xp ?? 0} XP`}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#07110B] border border-[#1B3624]">
              <span className="text-[10px] font-mono text-[#8C9891]">TREINOS</span>
              <div className="text-lg font-black text-[#F5F7F5]">
                {loading ? '...' : (playerData?.trainings_completed ?? 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#07110B] border border-[#1B3624]">
              <span className="text-[10px] font-mono text-[#8C9891]">MELHOR PONTUAÇÃO</span>
              <div className="text-lg font-black text-amber-400">
                {loading ? '...' : `${playerData?.best_score ?? 0} pts`}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}</span>
          </button>
        </form>
      </div>

      {/* Cloud & Supabase Identity Section */}
      <CloudLinkCard />

      {/* Data Management Section (Requirement 26) */}
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-4">
        <h3 className="text-sm font-bold text-[#F5F7F5]">Gerenciamento de Dados Locais</h3>
        <p className="text-xs text-[#8C9891]">
          Como o Motion Tennis opera com banco local SQLite, você tem total autonomia para restaurar os dados de demonstração ou zerar para um novo atleta.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleResetDemo}
            className="flex-1 py-3 px-4 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] hover:bg-[#39FF88]/10 text-xs font-mono font-bold tracking-wider uppercase flex items-center justify-center space-x-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTAURAR DEMONSTRAÇÃO (NICOLAS LV 12)</span>
          </button>

          <button
            onClick={handleClearData}
            className="py-3 px-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-400 hover:bg-rose-950/60 text-xs font-mono font-bold tracking-wider uppercase flex items-center justify-center space-x-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>ZERAR DADOS (NOVO JOGADOR)</span>
          </button>
        </div>
      </div>

    </div>
  );
}
