import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogIn,
  Lock,
  User,
  ArrowLeft,
  ShieldAlert,
  Play,
  UserCheck,
  Sparkles,
  GraduationCap,
  Wifi,
  WifiOff,
  QrCode,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSavedServerUrl,
  testServerConnection,
  isNativeMobile
} from '../services/serverConfig';
import QrScannerOverlay from '../components/mobile/QrScannerOverlay';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState('account'); // 'account' | 'guest'
  const usernameInputRef = useRef(null);

  // Server state
  const [serverState, setServerState] = useState({
    status: 'checking', // 'checking' | 'connected' | 'disconnected'
    url: '',
    name: '',
    latency: null,
    error: null
  });
  const [showScanner, setShowScanner] = useState(false);

  const { login, startGuest } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkServer();
    const onServerChanged = () => checkServer();
    window.addEventListener('smart_tennis_server_changed', onServerChanged);
    return () => window.removeEventListener('smart_tennis_server_changed', onServerChanged);
  }, []);

  const checkServer = async () => {
    const saved = getSavedServerUrl();
    if (!saved && isNativeMobile()) {
      setServerState({
        status: 'disconnected',
        url: '',
        name: '',
        latency: null,
        error: 'Nenhum servidor configurado.'
      });
      return;
    }

    setServerState((prev) => ({ ...prev, status: 'checking' }));
    const res = await testServerConnection(saved);
    if (res.success) {
      setServerState({
        status: 'connected',
        url: res.serverUrl,
        name: res.serverName,
        latency: res.latency,
        error: null
      });
    } else {
      setServerState({
        status: 'disconnected',
        url: saved || '',
        name: '',
        latency: null,
        error: res.error || 'Servidor inacessível.'
      });
    }
  };

  const handleSelectAccount = () => {
    setSelectedEntry('account');
    setError(null);
    setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 50);
  };

  const handlePlayAsGuest = async () => {
    setSelectedEntry('guest');
    setError(null);

    // Se estiver no celular nativo e sem conexão
    if (isNativeMobile() && serverState.status === 'disconnected') {
      setError('Não é possível conectar sem o servidor. Conecte ao mesmo Wi-Fi do notebook e escaneie o QR Code.');
      return;
    }

    setGuestLoading(true);
    try {
      await startGuest();
      navigate('/app/play');
    } catch (err) {
      if (err.code === 'SERVER_NOT_CONFIGURED') {
        setError('Nenhum servidor configurado. Escaneie o QR Code ou informe o IP do notebook.');
      } else if (err.code === 'UNEXPECTED_HTML_RESPONSE') {
        setError('Erro de conexão: o aplicativo recebeu uma página web (HTML) em vez da API. Verifique o IP do notebook.');
      } else if (err.code === 'NETWORK_ERROR') {
        setError('Não foi possível alcançar o servidor Motion Tennis. Verifique o Wi-Fi.');
      } else {
        setError(err.message || 'Falha ao iniciar modo visitante.');
      }
    } finally {
      setGuestLoading(false);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    // Se estiver no mobile nativo e desconectado, bloqueia tentativa com mensagem amigável
    if (isNativeMobile() && serverState.status === 'disconnected') {
      setError('Não é possível entrar sem conexão com o servidor. Escaneie o QR Code ou informe o IP do notebook antes de fazer login.');
      return;
    }

    setLoading(true);

    try {
      const loggedUser = await login(username, password);
      if (loggedUser.role === 'admin') {
        navigate('/admin/overview');
      } else {
        navigate('/app/dashboard');
      }
    } catch (err) {
      if (err.code === 'SERVER_NOT_CONFIGURED') {
        setError('Nenhum servidor configurado. Toque em "Escanear QR Code" ou configure o IP do notebook.');
      } else if (err.code === 'UNEXPECTED_HTML_RESPONSE') {
        setError('Erro de conexão: o servidor respondeu com uma página web (HTML) em vez da API. Verifique o IP configurado.');
      } else if (err.code === 'NETWORK_ERROR') {
        setError('Falha de rede: não foi possível comunicar com o servidor Motion Tennis. Verifique se o notebook está ligado na mesma rede Wi-Fi.');
      } else if (err.status === 401 || err.status === 403) {
        setError('Usuário ou senha incorretos.');
      } else {
        setError(err.message || 'Falha ao autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (userType) => {
    setSelectedEntry('account');
    if (userType === 'nicolas') {
      setUsername('nicolas');
      setPassword('nicolas123');
    } else {
      setUsername('admin');
      setPassword('admin123');
    }
  };

  return (
    <div className="min-h-screen bg-[#07110B] text-[#F5F7F5] flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Background glow & court grid */}
      <div className="absolute inset-0 bg-tech-grid opacity-20 pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#39FF88]/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top bar */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between z-10">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-xs font-mono text-[#8C9891] hover:text-[#39FF88] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </Link>
        <span className="text-[10px] font-mono text-[#39FF88] uppercase bg-[#39FF88]/10 px-2 py-0.5 rounded border border-[#39FF88]/30">
          Acesso Motion Tennis
        </span>
      </div>

      {/* Main Card */}
      <div className="max-w-xl w-full mx-auto my-auto z-10 py-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] shadow-2xl space-y-6">
          {/* Logo & Heading */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88] shadow-neon-sm">
              <LogIn className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-wider">
              <span>MOTION </span>
              <span className="text-[#39FF88] text-glow-neon">TENNIS</span>
            </h1>
            <p className="text-xs text-[#8C9891]">
              Escolha como deseja acessar a quadra interativa:
            </p>
          </div>

          {/* Status do Servidor e Botão de QR Code Integrado */}
          <div
            data-testid="login-server-banner"
            className={`p-3.5 rounded-2xl border transition-all ${
              serverState.status === 'connected'
                ? 'bg-[#0D1F14] border-[#39FF88]/40 text-[#39FF88]'
                : serverState.status === 'checking'
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  serverState.status === 'connected' ? 'bg-[#153420] text-[#39FF88]' : 'bg-rose-900/60 text-rose-300'
                }`}>
                  {serverState.status === 'connected' ? (
                    <Wifi className="w-4 h-4" />
                  ) : serverState.status === 'checking' ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <WifiOff className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>
                      {serverState.status === 'connected'
                        ? 'SERVIDOR ONLINE'
                        : serverState.status === 'checking'
                        ? 'VERIFICANDO SERVIDOR...'
                        : 'SERVIDOR DESCONECTADO'}
                    </span>
                    {serverState.latency && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-emerald-400">
                        {serverState.latency} ms
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[#8C9891] truncate max-w-[200px] sm:max-w-xs">
                    {serverState.url || '(nenhum servidor configurado)'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  data-testid="btn-login-scan-qr"
                  className="px-2.5 py-1.5 rounded-xl bg-[#14301D] hover:bg-[#1C4428] text-[#39FF88] border border-[#39FF88]/30 text-xs font-mono font-bold flex items-center gap-1.5 transition shadow-sm"
                  title="Escanear QR Code do Servidor"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">Escanear QR</span>
                </button>
                <Link
                  to="/mobile/connect"
                  data-testid="link-login-mobile-connect"
                  className="p-1.5 rounded-xl bg-[#122418] hover:bg-[#1A3824] text-[#8C9891] hover:text-[#39FF88] border border-[#1E3B26] transition"
                  title="Configurações de Conexão"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {serverState.status === 'disconnected' && (
              <div className="mt-2.5 pt-2 border-t border-rose-500/20 text-[11px] text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span>Conecte-se ao servidor Motion Tennis no notebook antes de fazer login.</span>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="px-3 py-1 rounded-lg bg-[#39FF88] hover:bg-[#2fe677] text-slate-950 font-black text-xs uppercase tracking-wider shrink-0 transition"
                >
                  Escanear QR Code Agora
                </button>
              </div>
            )}
          </div>

          {/* Escolha de Entrada: Conta Cadastrada vs Visitante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="entry-choice-panel">
            <button
              type="button"
              data-testid="btn-enter-with-account"
              onClick={handleSelectAccount}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between space-y-2 ${
                selectedEntry === 'account'
                  ? 'bg-[#102216] border-[#39FF88] shadow-[0_0_20px_rgba(57,255,136,0.2)]'
                  : 'bg-[#07110B] border-[#1B3624] hover:border-[#39FF88]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <UserCheck className="w-5 h-5 text-[#39FF88]" />
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#39FF88]/15 text-[#39FF88]">
                  Com Histórico & XP
                </span>
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-[#F5F7F5]">
                  ENTRAR COM MINHA CONTA
                </div>
                <div className="text-[11px] text-[#8C9891] mt-0.5">
                  Salva histórico, pontuação, evolução de atributos e conquistas.
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="btn-play-as-guest"
              onClick={handlePlayAsGuest}
              disabled={guestLoading || loading}
              className="p-4 rounded-2xl border-2 bg-[#07110B] border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-950/20 text-left transition-all flex flex-col justify-between space-y-2 shadow-[0_0_20px_rgba(34,211,238,0.12)] disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <Play className="w-5 h-5 text-cyan-400" />
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-400/15 text-cyan-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Acesso Rápido
                </span>
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-cyan-300">
                  {guestLoading ? 'INICIANDO VISITANTE...' : 'JOGAR COMO VISITANTE'}
                </div>
                <div className="text-[11px] text-[#8C9891] mt-0.5">
                  Jogue agora sem login ou cadastro. Placar temporário na partida.
                </div>
              </div>
            </button>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-mono flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="leading-relaxed">
                <span className="font-bold block">Aviso:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Form de Conta Cadastrada */}
          <form onSubmit={handleLogin} className="space-y-4 pt-2 border-t border-[#1B3624]">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#39FF88] font-bold">
              Autenticação de Conta Cadastrada
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8C9891] mb-1.5 uppercase">
                Usuário
              </label>
              <div className="relative">
                <input
                  ref={usernameInputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nicolas ou admin"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors"
                  required
                />
                <User className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8C9891] mb-1.5 uppercase">
                Senha
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors"
                  required
                />
                <Lock className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || guestLoading}
              className="w-full py-3.5 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon transition-all disabled:opacity-50"
            >
              <span>{loading ? 'AUTENTICANDO...' : 'ENTRAR COM MINHA CONTA'}</span>
            </button>
          </form>

          {/* Quick Demo Access Buttons */}
          <div className="pt-4 border-t border-[#1B3624] space-y-2">
            <span className="block text-center text-[10px] font-mono text-[#8C9891] uppercase">
              Acesso Rápido de Demonstração
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('nicolas')}
                className="py-2 px-3 rounded-xl bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88]/50 text-[11px] font-mono text-[#8C9891] hover:text-[#39FF88] transition-colors"
              >
                Jogador: Nicolas
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('admin')}
                className="py-2 px-3 rounded-xl bg-[#07110B] border border-[#1B3624] hover:border-amber-400/50 text-[11px] font-mono text-[#8C9891] hover:text-amber-400 transition-colors"
              >
                Admin: admin
              </button>
            </div>

            <Link
              to="/academy"
              data-testid="login-link-free-academy"
              className="mt-2 w-full py-2.5 px-4 rounded-xl bg-[#102216] border border-[#39FF88]/40 hover:border-[#39FF88] text-xs font-mono text-[#39FF88] flex items-center justify-center space-x-2 transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Acessar Motion Tennis Academy (100% Gratuita • Sem Login)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Camera QR Scanner Overlay Modal */}
      <QrScannerOverlay
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={() => {
          setShowScanner(false);
          checkServer();
        }}
      />

      {/* Footer */}
      <div className="max-w-xl w-full mx-auto text-center text-[11px] font-mono text-[#8C9891]/60 z-10">
        Motion Tennis Plataforma Local • Autenticação Criptografada & Modo Visitante Isolado
      </div>
    </div>
  );
}
