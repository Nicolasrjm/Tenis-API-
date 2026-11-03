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
  CheckCircle2,
  Cloud,
  Mail,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { cloudDataService } from '../../services/cloudDataService';
import { getStoredCloudSession, clearCloudSession } from '../../services/cloudAuthService';
import { getSavedServerUrl, testServerConnection } from '../../services/serverConfig';
import MobileVisitorGuard from '../../components/mobile/MobileVisitorGuard';

export default function MobileProfilePage() {
  const { user, isGuest, logout } = useAuth();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [cloudIdentity, setCloudIdentity] = useState(null);
  const [serverStatus, setServerStatus] = useState({ url: '', ping: null, online: false });
  const [loading, setLoading] = useState(true);
  const [isCloudActive, setIsCloudActive] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    loadProfile();
  }, [isGuest, user?.id]);

  const loadProfile = async () => {
    setLoading(true);

    const cloudSession = getStoredCloudSession();
    let loadedFromCloud = false;

    if (cloudSession?.accessToken) {
      try {
        const profile = await cloudDataService.getCloudProfile({
          accessToken: cloudSession.accessToken
        });

        if (profile) {
          setPlayer({
            name: profile.display_name || user?.name || 'Atleta',
            avatar: profile.avatar || user?.avatar || '🎾',
            level: profile.level || 1,
            xp: profile.xp || 0,
            xp_next: profile.xp_next || 250,
            title: profile.title || 'Iniciante',
            precision: profile.overall_accuracy !== undefined ? Number(profile.overall_accuracy) : 0,
            total_matches: profile.total_matches || 0,
            best_score: 0,
            last_synced_at: profile.last_synced_at
          });
          setCloudIdentity({
            id: cloudSession.user?.id || profile.user_id,
            email: cloudSession.user?.email || user?.email,
            provider: 'supabase',
            lastSyncedAt: profile.last_synced_at
          });
          setIsCloudActive(true);
          loadedFromCloud = true;
        }
      } catch (e) {
        console.warn('[MOBILE PROFILE] Falha ao carregar perfil da nuvem:', e);
      }
    }

    if (!loadedFromCloud) {
      try {
        const [playerData, conn] = await Promise.all([
          api.getPlayer().catch(() => user),
          testServerConnection()
        ]);
        if (playerData) setPlayer(playerData);
        setServerStatus({
          url: getSavedServerUrl() || 'http://localhost:3000',
          ping: conn.latency,
          online: conn.success
        });
      } catch (_) {}
    } else {
      // Testa conexão com notebook local em background
      testServerConnection().then((conn) => {
        setServerStatus({
          url: getSavedServerUrl() || '(rede local)',
          ping: conn.latency,
          online: conn.success
        });
      });
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    clearCloudSession();
    if (logout) await logout();
    navigate('/login');
  };

  if (isGuest) {
    return <MobileVisitorGuard featureName="o Perfil do Atleta" />;
  }

  const currentXp = player?.xp || 0;
  const nextXp = player?.xp_next || 250;
  const xpPct = Math.min(100, Math.max(0, Math.round((currentXp / nextXp) * 100)));

  return (
    <div className="p-4 sm:p-5 space-y-5 animate-fadeIn">
      
      {/* 1. Player Identity Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-b from-[#0D2215] to-[#07130D] border border-[#1C4229] flex items-center space-x-4 shadow-[0_0_20px_rgba(57,255,136,0.1)]">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[#14301D] border-2 border-[#39FF88] flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(57,255,136,0.25)]">
            {player?.avatar || user?.avatar || '🎾'}
          </div>
          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-black border border-[#39FF88] text-[9px] font-mono font-bold text-[#39FF88]">
            LV.{player?.level || 1}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-black text-white truncate">
              {player?.name || user?.name || 'Atleta'}
            </h1>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-[#14301D] text-[#39FF88] border border-[#39FF88]/30">
              {player?.title || 'Atleta'}
            </span>
          </div>

          <span className="text-xs text-[#8C9891] font-mono block truncate">
            {cloudIdentity?.email || user?.email || `@${user?.username || 'atleta'}`}
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

      {/* 2. Identidade Cloud Autenticada */}
      <div className="p-4 rounded-3xl bg-[#09150E] border border-[#163020] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Identidade Cloud Supabase
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-400/30">
            {isCloudActive ? 'Conectado' : 'Local'}
          </span>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-[#060D08] border border-[#142A1B] flex items-center justify-between">
            <span className="text-[#8C9891]">E-mail Oficial:</span>
            <span className="text-white font-bold truncate max-w-[200px]">
              {cloudIdentity?.email || user?.email || 'atleta@motiontennis.com'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#060D08] border border-[#142A1B] flex items-center justify-between">
            <span className="text-[#8C9891]">UUID da Conta:</span>
            <span className="text-cyan-300 text-[11px] font-mono truncate max-w-[200px]">
              {cloudIdentity?.id || user?.cloudUserId || 'Sincronizado'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#060D08] border border-[#142A1B] flex items-center justify-between">
            <span className="text-[#8C9891]">Último Sincronismo:</span>
            <span className="text-[#39FF88] text-[11px]">
              {player?.last_synced_at ? new Date(player.last_synced_at).toLocaleString('pt-BR') : 'Tempo Real'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Conexão com Notebook da Quadra */}
      <div className="p-4 rounded-3xl bg-[#09150E] border border-[#163020] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wifi className="w-4 h-4 text-[#39FF88]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Notebook da Quadra
            </h3>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
            serverStatus.online
              ? 'bg-[#122A1A] text-[#39FF88] border border-[#39FF88]/40'
              : 'bg-slate-900 text-[#8C9891]'
          }`}>
            {serverStatus.online ? `${serverStatus.ping || 12} ms` : 'Independente (Cloud)'}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#060D08] border border-[#142A1B] text-[11px] font-mono text-[#8C9891]">
          <span className="truncate mr-2">{serverStatus.url}</span>
          <button
            onClick={() => navigate('/mobile/connect')}
            data-testid="btn-manage-server-connection"
            className="text-[#39FF88] hover:underline shrink-0 font-bold"
          >
            Configurar →
          </button>
        </div>
      </div>

      {/* 4. Ação de Logout */}
      <button
        onClick={handleLogout}
        data-testid="btn-profile-logout"
        className="w-full py-3.5 px-4 rounded-2xl bg-[#140C0E] hover:bg-[#1E1114] border border-rose-900/40 text-rose-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-sm"
      >
        <LogOut className="w-4 h-4" />
        <span>Sair da Conta no Dispositivo</span>
      </button>

    </div>
  );
}
