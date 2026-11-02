import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Trophy,
  Award,
  Zap,
  Target,
  Flame,
  Wifi,
  LogOut,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { getSavedServerUrl, testServerConnection } from '../../services/serverConfig';
import MobileVisitorGuard from '../../components/mobile/MobileVisitorGuard';

export default function MobileProfilePage() {
  const { user, isGuest, logout } = useAuth();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [achievementsData, setAchievementsData] = useState({ achievements: [], unlockedCount: 0, total: 0 });
  const [serverStatus, setServerStatus] = useState({ url: '', ping: null, online: false });
  const [loading, setLoading] = useState(true);
  const [achFilter, setAchFilter] = useState('all'); // 'all' | 'unlocked' | 'locked'

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    loadProfile();
  }, [isGuest, user?.id]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [playerData, achs, conn] = await Promise.all([
        api.getPlayer().catch(() => user),
        api.getAchievements().catch(() => ({ achievements: [], unlockedCount: 0, total: 0 })),
        testServerConnection()
      ]);

      if (playerData) setPlayer(playerData);
      if (achs) setAchievementsData(achs);

      setServerStatus({
        url: getSavedServerUrl() || 'http://192.168.0.27:3000',
        ping: conn.latency,
        online: conn.success
      });
    } catch (e) {
      console.warn('Erro ao carregar perfil:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (logout) await logout();
    navigate('/login');
  };

  if (isGuest) {
    return <MobileVisitorGuard featureName="o Perfil do Atleta" />;
  }

  const currentXp = player?.xp || 0;
  const nextXp = player?.xp_next || 250;
  const xpPct = Math.min(100, Math.max(0, Math.round((currentXp / nextXp) * 100)));

  const achievementsList = achievementsData.achievements || [];
  const filteredAchievements = achievementsList.filter((a) => {
    if (achFilter === 'unlocked') return a.unlocked === 1;
    if (achFilter === 'locked') return a.unlocked === 0;
    return true;
  });

  return (
    <div className="p-4 sm:p-5 space-y-5 animate-fadeIn">
      
      {/* 1. Player Identity Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-b from-[#0D2215] to-[#07130D] border border-[#1C4229] flex items-center space-x-4 shadow-[0_0_20px_rgba(57,255,136,0.1)]">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[#14301D] border-2 border-[#39FF88] flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(57,255,136,0.25)]">
            {player?.avatar || user?.avatar || '🚀'}
          </div>
          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-black border border-[#39FF88] text-[9px] font-mono font-bold text-[#39FF88]">
            LV.{player?.level || 1}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-black text-white truncate">
              {player?.name || user?.name || 'Jogador'}
            </h1>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-[#14301D] text-[#39FF88] border border-[#39FF88]/30">
              {player?.title || 'Atleta'}
            </span>
          </div>

          <span className="text-xs text-[#8C9891] font-mono block">
            @{user?.username || 'nicolas'}
          </span>

          <div className="mt-2 w-full bg-[#070F0A] h-2 rounded-full overflow-hidden border border-[#142A1B]">
            <div
              className="bg-[#39FF88] h-full rounded-full transition-all duration-500 shadow-[0_0_6px_#39FF88]"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[#8C9891] mt-0.5 block">
            {currentXp} / {nextXp} XP ({xpPct}%)
          </span>
        </div>
      </div>

      {/* 2. Career Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-2xl bg-[#09150E] border border-[#142A1B] text-center">
          <span className="text-[10px] font-mono text-[#8C9891] uppercase block">Partidas</span>
          <span className="text-base font-black font-mono text-white">{player?.trainings_completed || 0}</span>
        </div>
        <div className="p-3 rounded-2xl bg-[#09150E] border border-[#142A1B] text-center">
          <span className="text-[10px] font-mono text-[#8C9891] uppercase block">Precisão</span>
          <span className="text-base font-black font-mono text-emerald-400">
            {player?.precision !== undefined && player?.precision !== null ? `${player.precision}%` : 'N/A'}
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-[#09150E] border border-[#142A1B] text-center">
          <span className="text-[10px] font-mono text-[#8C9891] uppercase block">Recorde</span>
          <span className="text-base font-black font-mono text-[#39FF88]">{player?.best_score || 0}p</span>
        </div>
      </div>

      {/* 3. Achievements Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Conquistas ({achievementsData.unlockedCount || 0}/{achievementsData.total || 0})
            </h2>
          </div>

          <div className="flex space-x-1 text-[10px] font-mono">
            <button
              onClick={() => setAchFilter('all')}
              className={`px-2 py-0.5 rounded ${achFilter === 'all' ? 'bg-[#14301D] text-[#39FF88]' : 'text-[#8C9891]'}`}
            >
              Todas
            </button>
            <button
              onClick={() => setAchFilter('unlocked')}
              className={`px-2 py-0.5 rounded ${achFilter === 'unlocked' ? 'bg-[#14301D] text-[#39FF88]' : 'text-[#8C9891]'}`}
            >
              Desbloqueadas
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredAchievements.map((ach) => (
            <div
              key={ach.id}
              className={`p-3 rounded-2xl border transition flex items-center justify-between ${
                ach.unlocked === 1
                  ? 'bg-[#09170F] border-[#1C4229]'
                  : 'bg-[#08100C] border-[#142219] opacity-75'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  ach.unlocked === 1
                    ? 'bg-[#14301D] border border-[#39FF88]/40 shadow-[0_0_10px_rgba(57,255,136,0.2)]'
                    : 'bg-black/50 border border-slate-800 text-slate-500'
                }`}>
                  {ach.unlocked === 1 ? (ach.icon || '🏆') : <Lock className="w-4 h-4 text-slate-600" />}
                </div>

                <div>
                  <h4 className={`text-xs font-bold ${ach.unlocked === 1 ? 'text-white' : 'text-slate-400'}`}>
                    {ach.title}
                  </h4>
                  <p className="text-[10px] text-[#8C9891] leading-tight">
                    {ach.description}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono font-bold text-[#39FF88]">
                  +{ach.xp_reward || 100} XP
                </span>
                {ach.unlocked === 1 && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#39FF88] ml-auto mt-0.5" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Server Connection Card */}
      <div className="p-4 rounded-2xl bg-[#09150E] border border-[#163020] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wifi className="w-4 h-4 text-[#39FF88]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Servidor Motion Tennis
            </h3>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
            serverStatus.online
              ? 'bg-[#122A1A] text-[#39FF88] border border-[#39FF88]/40'
              : 'bg-rose-950/60 text-rose-300'
          }`}>
            {serverStatus.online ? `${serverStatus.ping || 12} ms` : 'Offline'}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#060D08] border border-[#142A1B] text-[11px] font-mono text-[#8C9891]">
          <span className="truncate mr-2">{serverStatus.url}</span>
          <button
            onClick={() => navigate('/mobile/connect')}
            data-testid="btn-manage-server-connection"
            className="text-[#39FF88] hover:underline shrink-0 font-bold"
          >
            Alterar / QR Code →
          </button>
        </div>
      </div>

      {/* 5. Logout Action */}
      <button
        onClick={handleLogout}
        data-testid="btn-profile-logout"
        className="w-full py-3 px-4 rounded-2xl bg-[#140C0E] hover:bg-[#1E1114] border border-rose-900/40 text-rose-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition"
      >
        <LogOut className="w-4 h-4" />
        <span>Sair da Minha Conta</span>
      </button>

    </div>
  );
}
