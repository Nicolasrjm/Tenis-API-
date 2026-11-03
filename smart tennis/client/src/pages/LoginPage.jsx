import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  Lock,
  User,
  Mail,
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
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSavedServerUrl,
  testServerConnection,
  isNativeMobile
} from '../services/serverConfig';
import QrScannerOverlay from '../components/mobile/QrScannerOverlay';

export default function LoginPage() {
  // Navigation tabs: 'login' | 'signup' | 'guest'
  const [activeTab, setActiveTab] = useState('login');
  
  // Login form state
  const [loginType, setLoginType] = useState('cloud'); // 'cloud' | 'local'
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  
  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  
  // Password recovery state
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(null);

  // Email confirmation state
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  // Status & messages
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
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

  const { login, loginCloud, signupCloud, recoverPasswordCloud, resendConfirmationEmail, startGuest } = useAuth();
  const navigate = useNavigate();

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResendingEmail(true);
    setResendStatus(null);
    try {
      const res = await resendConfirmationEmail(unconfirmedEmail);
      setResendStatus({
        success: true,
        message: res?.message || 'E-mail de confirmação reenviado com sucesso! Verifique sua caixa de entrada e spam.'
      });
    } catch (err) {
      setResendStatus({
        success: false,
        message: err?.message || 'Falha ao reenviar e-mail de confirmação. Tente novamente mais tarde.'
      });
    } finally {
      setResendingEmail(false);
    }
  };

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
    setActiveTab('login');
    setError(null);
    setInfoMessage(null);
    setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 50);
  };

  const handlePlayAsGuest = async () => {
    setActiveTab('guest');
    setError(null);
    setInfoMessage(null);

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
    setInfoMessage(null);

    if (loginType === 'local' && isNativeMobile() && serverState.status === 'disconnected') {
      setError('Para acessar uma conta local no aplicativo móvel, conecte-se ao Wi-Fi do notebook. Para acessar seu progresso de qualquer lugar com internet, selecione "Online" e entre com seu e-mail.');
      return;
    }

    setLoading(true);

    try {
      let loggedUser = null;
      const isEmail = emailOrUser.includes('@');

      if (loginType === 'cloud' || isEmail) {
        try {
          // Autentica via Supabase Auth
          loggedUser = await loginCloud(emailOrUser.trim(), password);
        } catch (cloudErr) {
          if (cloudErr.code === 'EMAIL_NOT_CONFIRMED') {
            setUnconfirmedEmail(emailOrUser.trim());
            setError('E-mail não confirmado. Por favor, ative sua conta pelo link enviado ao seu e-mail ou solicite novo link abaixo.');
            return;
          }
          // Se a nuvem estiver indisponível ou offline, tenta fallback local transparente com PBKDF2 em cache
          if (cloudErr.code === 'CLOUD_UNAVAILABLE' || cloudErr.code === 'NETWORK_ERROR') {
            try {
              loggedUser = await login(emailOrUser.trim(), password);
            } catch (offlineErr) {
              setError('Nuvem Supabase offline e credenciais locais não encontradas neste equipamento. Verifique sua conexão.');
              return;
            }
          } else {
            throw cloudErr;
          }
        }
      } else {
        // Autentica via SQLite local
        loggedUser = await login(emailOrUser.trim(), password);
      }

      if (loggedUser?.role === 'admin') {
        navigate('/admin/overview');
      } else if (isNativeMobile() || window.innerWidth < 768 || loggedUser?.isCloudOnly) {
        navigate('/mobile/dashboard');
      } else {
        navigate('/app/dashboard');
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_CONFIRMED') {
        setUnconfirmedEmail(emailOrUser.trim());
        setError('E-mail não confirmado. Por favor, ative sua conta pelo link enviado ao seu e-mail ou solicite novo link abaixo.');
      } else if (err.code === 'SERVER_NOT_CONFIGURED') {
        setError('Nenhum servidor configurado. Toque em "Escanear QR Code" ou configure o IP do notebook.');
      } else if (err.code === 'UNEXPECTED_HTML_RESPONSE') {
        setError('Erro de conexão: o servidor respondeu com uma página web (HTML) em vez da API. Verifique o IP configurado.');
      } else if (err.code === 'NETWORK_ERROR' || err.code === 'CLOUD_UNAVAILABLE') {
        setError('Falha de rede: não foi possível comunicar com o servidor ou com a nuvem. Para jogar offline, utilize a opção "Conta Local (Offline / Demo)".');
      } else if (err.status === 401 || err.status === 403 || err.code === 'AUTH_ERROR') {
        setError('Credenciais incorretas: e-mail/usuário ou senha inválidos.');
      } else {
        setError(err.message || 'Falha ao autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!signupName.trim()) {
      setError('Informe seu nome completo para registro do atleta.');
      return;
    }

    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const res = await signupCloud(signupName.trim(), signupEmail.trim(), signupPassword);
      if (res.requiresConfirmation) {
        setUnconfirmedEmail(signupEmail.trim());
        setInfoMessage('Conta cadastrada com sucesso! Um link de confirmação foi enviado para o seu e-mail. Por favor, confirme para realizar seu primeiro login.');
        setActiveTab('login');
        setEmailOrUser(signupEmail.trim());
      } else {
        setInfoMessage('Conta criada com sucesso! Redirecionando...');
        setTimeout(() => {
          navigate('/app/dashboard');
        }, 800);
      }
    } catch (err) {
      setError(err.message || 'Falha ao realizar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverPassword = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setRecoverySuccess(null);

    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setError('Informe um e-mail válido para recuperação de senha.');
      return;
    }

    setLoading(true);
    try {
      const res = await recoverPasswordCloud(recoveryEmail.trim());
      setRecoverySuccess(res.message || 'E-mail de recuperação enviado com sucesso!');
    } catch (err) {
      setError(err.message || 'Falha ao solicitar recuperação de senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (userType) => {
    setActiveTab('login');
    setLoginType('local');
    setError(null);
    setInfoMessage(null);
    if (userType === 'nicolas') {
      setEmailOrUser('nicolas');
      setPassword('nicolas123');
    } else {
      setEmailOrUser('admin');
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
          <span>Voltar ao Início</span>
        </Link>
        <span className="text-[10px] font-mono text-[#39FF88] uppercase bg-[#39FF88]/10 px-2.5 py-1 rounded-full border border-[#39FF88]/30">
          Motion Tennis • Autenticação Segura
        </span>
      </div>

      {/* Main Card */}
      <div className="max-w-xl w-full mx-auto my-auto z-10 py-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] shadow-2xl space-y-5">
          {/* Logo & Heading */}
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88] shadow-neon-sm">
              <LogIn className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-wider">
              <span>MOTION </span>
              <span className="text-[#39FF88] text-glow-neon">TENNIS</span>
            </h1>
            <p className="text-xs text-[#8C9891]">
              Acesse sua conta oficial para sincronizar treinos e conquistas
            </p>
          </div>

          {/* Status do Servidor e Botão de QR Code Integrado */}
          <div
            data-testid="login-server-banner"
            className={`p-3 rounded-2xl border transition-all ${
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
                    {serverState.url || '(servidor local ativo)'}
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
                  <span className="text-[11px] uppercase tracking-wider">QR Code</span>
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
              <div className="mt-2 pt-2 border-t border-rose-500/20 text-[11px] text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span>Conecte-se ao servidor Motion Tennis antes de fazer login.</span>
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

          {/* Abas Principais: Entrar | Criar Conta | Visitante */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#07110B] border border-[#1B3624]" data-testid="entry-choice-panel">
            <button
              type="button"
              data-testid="btn-enter-with-account"
              onClick={handleSelectAccount}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'login'
                  ? 'bg-[#16291C] text-[#39FF88] border border-[#39FF88]/40 shadow-sm'
                  : 'text-[#8C9891] hover:text-[#F5F7F5]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>

            <button
              type="button"
              data-testid="btn-register-tab"
              onClick={() => {
                setActiveTab('signup');
                setError(null);
                setInfoMessage(null);
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'signup'
                  ? 'bg-[#16291C] text-[#39FF88] border border-[#39FF88]/40 shadow-sm'
                  : 'text-[#8C9891] hover:text-[#F5F7F5]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Criar Conta</span>
            </button>

            <button
              type="button"
              data-testid="btn-play-as-guest"
              onClick={handlePlayAsGuest}
              disabled={guestLoading || loading}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'guest'
                  ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-400/40 shadow-sm'
                  : 'text-cyan-400 hover:text-cyan-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{guestLoading ? 'Iniciando...' : 'Visitante'}</span>
            </button>
          </div>

          {/* Mensagens de Feedback */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-mono flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="leading-relaxed">
                <span className="font-bold block">Aviso:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-xl bg-[#39FF88]/10 border border-[#39FF88]/40 text-[#39FF88] text-xs font-mono flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#39FF88]" />
              <div className="leading-relaxed">
                <span className="font-bold block">Sucesso:</span>
                <span>{infoMessage}</span>
              </div>
            </div>
          )}

          {/* Alerta de Confirmação de E-mail Pendente */}
          {unconfirmedEmail && (
            <div
              data-testid="unconfirmed-email-banner"
              className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono space-y-2.5"
            >
              <div className="flex items-start space-x-2.5">
                <Mail className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="leading-relaxed">
                  <span className="font-bold text-amber-300 block">Confirmação de e-mail necessária:</span>
                  <span>
                    Enviamos um link de ativação para <strong>{unconfirmedEmail}</strong>. Acesse sua caixa de entrada (ou pasta de spam) e clique no link para ativar seu atleta no Motion Tennis.
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-[11px] text-[#8C9891]">Não recebeu a mensagem de ativação?</span>
                <button
                  type="button"
                  data-testid="btn-resend-confirmation"
                  disabled={resendingEmail}
                  onClick={handleResendConfirmation}
                  className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {resendingEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Reenviando link...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reenviar confirmação</span>
                    </>
                  )}
                </button>
              </div>
              {resendStatus && (
                <div
                  className={`p-2 rounded-lg text-[11px] ${
                    resendStatus.success
                      ? 'bg-[#39FF88]/10 text-[#39FF88] border border-[#39FF88]/30'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {resendStatus.message}
                </div>
              )}
            </div>
          )}

          {/* ABA 1: ENTRAR */}
          {activeTab === 'login' && !showRecovery && (
            <form onSubmit={handleLogin} className="space-y-4 pt-1">
              <div className="flex items-center justify-between pb-1">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#39FF88] font-bold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Acesso do Atleta</span>
                </div>
                <div className="flex items-center space-x-1 bg-[#07110B] p-0.5 rounded-lg border border-[#1B3624]">
                  <button
                    type="button"
                    onClick={() => setLoginType('cloud')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      loginType === 'cloud'
                        ? 'bg-[#39FF88] text-[#07110B]'
                        : 'text-[#8C9891] hover:text-[#F5F7F5]'
                    }`}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginType('local')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      loginType === 'local'
                        ? 'bg-[#16291C] text-[#39FF88] border border-[#39FF88]/30'
                        : 'text-[#8C9891] hover:text-[#F5F7F5]'
                    }`}
                  >
                    Local / Demo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8C9891] mb-1.5 uppercase">
                  {loginType === 'cloud' ? 'E-mail da Conta Online' : 'Usuário Local'}
                </label>
                <div className="relative">
                  <input
                    ref={usernameInputRef}
                    type={loginType === 'cloud' ? 'email' : 'text'}
                    value={emailOrUser}
                    onChange={(e) => setEmailOrUser(e.target.value)}
                    placeholder={loginType === 'cloud' ? 'atleta@exemplo.com' : 'nicolas ou admin'}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors font-sans"
                    required
                  />
                  {loginType === 'cloud' ? (
                    <Mail className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3.5" />
                  ) : (
                    <User className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3.5" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono text-[#8C9891] uppercase">
                    Senha
                  </label>
                  {loginType === 'cloud' && (
                    <button
                      type="button"
                      onClick={() => setShowRecovery(true)}
                      className="text-[11px] font-mono text-[#39FF88] hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors font-sans"
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
          )}

          {/* RECUPERAÇÃO DE SENHA */}
          {activeTab === 'login' && showRecovery && (
            <form onSubmit={handleRecoverPassword} className="space-y-4 pt-1">
              <div className="flex items-center justify-between pb-1">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#39FF88] font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Recuperação de Senha Online</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecovery(false);
                    setRecoverySuccess(null);
                  }}
                  className="text-xs font-mono text-[#8C9891] hover:text-[#F5F7F5]"
                >
                  Voltar ao login
                </button>
              </div>

              <p className="text-xs text-[#8C9891] leading-relaxed">
                Informe o e-mail cadastrado na nuvem Supabase. Enviaremos um link seguro para você redefinir sua senha de acesso.
              </p>

              <div>
                <label className="block text-xs font-mono text-[#8C9891] mb-1.5 uppercase">
                  E-mail Cadastrado
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="atleta@exemplo.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors font-sans"
                    required
                  />
                  <Mail className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3.5" />
                </div>
              </div>

              {recoverySuccess && (
                <div className="p-3 rounded-xl bg-[#39FF88]/15 border border-[#39FF88]/40 text-[#39FF88] text-xs font-mono">
                  {recoverySuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon transition-all disabled:opacity-50"
              >
                <span>{loading ? 'ENVIANDO...' : 'ENVIAR LINK DE RECUPERAÇÃO'}</span>
              </button>
            </form>
          )}

          {/* ABA 2: CRIAR CONTA */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3.5 pt-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#39FF88] font-bold flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                <span>Cadastro Oficial de Atleta</span>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8C9891] mb-1 uppercase">
                  Nome Completo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors font-sans"
                    required
                  />
                  <User className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8C9891] mb-1 uppercase">
                  E-mail Oficial
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="atleta@exemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors font-sans"
                    required
                  />
                  <Mail className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#8C9891] mb-1 uppercase">
                    Senha (mín. 6)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors font-sans"
                      required
                    />
                    <Lock className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#8C9891] mb-1 uppercase">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] text-sm focus:border-[#39FF88] focus:outline-none transition-colors font-sans"
                      required
                    />
                    <Lock className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3" />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#8C9891] leading-relaxed">
                Ao criar sua conta, sua identidade será vinculada com segurança e suas partidas serão sincronizadas automaticamente com a nuvem e com este equipamento.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon transition-all disabled:opacity-50"
              >
                <span>{loading ? 'CRIANDO CONTA...' : 'CRIAR MINHA CONTA OFICIAL'}</span>
              </button>
            </form>
          )}

          {/* ABA 3: VISITANTE */}
          {activeTab === 'guest' && (
            <div className="space-y-4 pt-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Modo Visitante • Acesso Imediato</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#07110B] border border-cyan-400/30 text-xs space-y-2 text-[#8C9891]">
                <p className="text-cyan-200 font-bold">
                  Ideal para jogos rápidos sem necessidade de e-mail ou senha:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Inicie o jogo diretamente na quadra física ou virtual;</li>
                  <li>Placar e telemetria funcionam em tempo real durante o jogo;</li>
                  <li>Dados são temporários e isolados de outros atletas;</li>
                  <li>Pode ser vinculado a uma conta permanente a qualquer momento.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handlePlayAsGuest}
                disabled={guestLoading}
                className="w-full py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{guestLoading ? 'INICIANDO PARTIDA...' : 'JOGAR AGORA COMO VISITANTE'}</span>
              </button>
            </div>
          )}

          {/* Quick Demo Access Buttons */}
          <div className="pt-4 border-t border-[#1B3624] space-y-2">
            <span className="block text-center text-[10px] font-mono text-[#8C9891] uppercase">
              Acesso Rápido de Demonstração (SQLite Local)
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
        Motion Tennis Plataforma Local • Autenticação Criptografada & Nuvem Supabase
      </div>
    </div>
  );
}
