import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  PlayCircle, 
  BarChart2, 
  GitFork, 
  GraduationCap, 
  Clock, 
  Trophy, 
  User, 
  LogOut, 
  LogIn,
  ShieldAlert, 
  Radio, 
  Menu, 
  X,
  Sparkles,
  QrCode,
  Smartphone,
  ChevronDown,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConnectMobileModal from '../components/ConnectMobileModal';

export default function PlayerLayout() {
  const { user, isGuest, logout, exitGuest, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [desempenhoOpen, setDesempenhoOpen] = useState(false);
  const desempenhoRef = useRef(null);

  // Fecha dropdown ao clicar fora ou pressionar ESC
  useEffect(() => {
    function handleClickOutside(event) {
      if (desempenhoRef.current && !desempenhoRef.current.contains(event.target)) {
        setDesempenhoOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setDesempenhoOpen(false);
      }
    }
    if (desempenhoOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [desempenhoOpen]);

  // Fecha dropdown ao mudar de rota
  useEffect(() => {
    setDesempenhoOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    if (isGuest) {
      await exitGuest();
    } else {
      await logout();
    }
    navigate('/login');
  };

  const isDesempenhoActive = 
    location.pathname.startsWith('/app/statistics') || 
    location.pathname.startsWith('/app/evolution');

  // Visitantes veem apenas Jogar e Academy gratuita
  const navItems = isGuest
    ? [
        { to: '/app/play', label: 'Jogar', icon: PlayCircle, highlight: true },
        { to: '/app/academy', label: 'Academy', icon: GraduationCap },
      ]
    : [
        { to: '/app/dashboard', label: 'Dashboard', icon: Home },
        { to: '/app/play', label: 'Jogar', icon: PlayCircle, highlight: true },
        { to: '/app/academy', label: 'Academy', icon: GraduationCap },
        { to: '/app/history', label: 'Histórico', icon: Clock },
        { to: '/app/achievements', label: 'Conquistas', icon: Trophy },
        { to: '/app/profile', label: 'Perfil', icon: User },
      ];

  return (
    <div className="min-h-screen bg-[#07110B] text-[#F5F7F5] flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[#07110B]/95 backdrop-blur border-b border-[#1B3624]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={isGuest ? '/app/play' : '/app/dashboard'} className="flex items-center space-x-2.5 group shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#0C1A11] border border-[#39FF88]/40 flex items-center justify-center shadow-neon-sm">
                <svg className="w-5 h-5 text-[#39FF88]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18" strokeDasharray="2 2" strokeOpacity="0.6" />
                  <path d="M3 12h18" strokeDasharray="2 2" strokeOpacity="0.6" />
                  <circle cx="12" cy="12" r="3" fill="#39FF88" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-base sm:text-lg font-black tracking-wider leading-none">
                  <span>MOTION </span>
                  <span className="text-[#39FF88] text-glow-neon">TENNIS</span>
                </span>
                <span className="text-[9px] text-[#8C9891] tracking-widest uppercase font-mono">
                  {isGuest ? 'Modo Visitante' : 'Área do Jogador'}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation (Otimizada para notebooks 1280x720 e 1366x768) */}
            <nav className="hidden lg:flex items-center space-x-1">
              {/* Dashboard */}
              {!isGuest && (
                <NavLink
                  to="/app/dashboard"
                  className={({ isActive }) =>
                    `flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                      isActive
                        ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                        : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                    }`
                  }
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </NavLink>
              )}

              {/* Jogar */}
              <NavLink
                to="/app/play"
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                    isActive
                      ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                      : 'bg-[#39FF88]/10 text-[#39FF88] hover:bg-[#39FF88]/20'
                  }`
                }
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Jogar</span>
              </NavLink>

              {/* Dropdown Desempenho (Agrupa Estatísticas e Evolução) */}
              {!isGuest && (
                <div className="relative" ref={desempenhoRef}>
                  <button
                    type="button"
                    data-testid="btn-nav-desempenho"
                    aria-haspopup="true"
                    aria-expanded={desempenhoOpen}
                    aria-controls="dropdown-desempenho"
                    onClick={() => setDesempenhoOpen((prev) => !prev)}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#39FF88]/50 ${
                      isDesempenhoActive
                        ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                        : desempenhoOpen
                        ? 'bg-[#0C1A11] text-[#F5F7F5] border border-[#16C96B]/30'
                        : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-[#39FF88]" />
                    <span>Desempenho</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        desempenhoOpen ? 'rotate-180 text-[#39FF88]' : 'text-[#8C9891]'
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu com Estatísticas e Evolução uma abaixo da outra */}
                  {desempenhoOpen && (
                    <div
                      id="dropdown-desempenho"
                      role="menu"
                      data-testid="dropdown-desempenho"
                      className="absolute top-full left-0 mt-2 w-56 rounded-2xl bg-[#09150E] border border-[#16C96B]/40 shadow-2xl p-1.5 z-50 flex flex-col space-y-1 backdrop-blur-md animate-fadeIn"
                    >
                      <NavLink
                        to="/app/statistics"
                        role="menuitem"
                        data-testid="link-nav-statistics"
                        onClick={() => setDesempenhoOpen(false)}
                        className={({ isActive }) =>
                          `flex items-start space-x-2.5 p-2.5 rounded-xl text-xs transition-all ${
                            isActive
                              ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm font-bold'
                              : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                          }`
                        }
                      >
                        <BarChart2 className="w-4 h-4 text-[#39FF88] mt-0.5 shrink-0" />
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-[#F5F7F5]">Estatísticas</span>
                          <span className="text-[10px] text-[#8C9891] font-normal font-mono">
                            Métricas de golpes e precisão
                          </span>
                        </div>
                      </NavLink>

                      <NavLink
                        to="/app/evolution"
                        role="menuitem"
                        data-testid="link-nav-evolution"
                        onClick={() => setDesempenhoOpen(false)}
                        className={({ isActive }) =>
                          `flex items-start space-x-2.5 p-2.5 rounded-xl text-xs transition-all ${
                            isActive
                              ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm font-bold'
                              : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                          }`
                        }
                      >
                        <GitFork className="w-4 h-4 text-[#39FF88] mt-0.5 shrink-0" />
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-[#F5F7F5]">Evolução</span>
                          <span className="text-[10px] text-[#8C9891] font-normal font-mono">
                            Árvore de habilidades e atributos
                          </span>
                        </div>
                      </NavLink>
                    </div>
                  )}
                </div>
              )}

              {/* Academy */}
              <NavLink
                to="/app/academy"
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                    isActive
                      ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                      : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                  }`
                }
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Academy</span>
              </NavLink>

              {/* Histórico */}
              {!isGuest && (
                <NavLink
                  to="/app/history"
                  className={({ isActive }) =>
                    `flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                      isActive
                        ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                        : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                    }`
                  }
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Histórico</span>
                </NavLink>
              )}

              {/* Conquistas */}
              {!isGuest && (
                <NavLink
                  to="/app/achievements"
                  className={({ isActive }) =>
                    `flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                      isActive
                        ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                        : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                    }`
                  }
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Conquistas</span>
                </NavLink>
              )}

              {/* Perfil */}
              {!isGuest && (
                <NavLink
                  to="/app/profile"
                  className={({ isActive }) =>
                    `flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                      isActive
                        ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                        : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                    }`
                  }
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Perfil</span>
                </NavLink>
              )}
            </nav>

            {/* Right side: Conectar Celular + Equipamento + Perfil/Logout */}
            <div className="hidden sm:flex items-center space-x-2 lg:space-x-2.5 shrink-0">
              <button
                onClick={() => setShowConnectModal(true)}
                data-testid="btn-connect-mobile-modal"
                className="px-2.5 py-1.5 rounded-xl bg-[#0C1A11] border border-[#39FF88]/40 hover:bg-[#122418] text-[#39FF88] text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                title="Conectar aplicativo celular via QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Conectar Celular</span>
              </button>

              <div className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#0C1A11] border border-[#1B3624] text-[10px] font-mono text-[#8C9891]">
                <Radio className="w-3 h-3 text-[#39FF88] animate-pulse" />
                <span>{user?.equipment?.name || 'MOTION TENNIS #001'}</span>
              </div>

              {isGuest ? (
                <>
                  <div
                    data-testid="guest-mode-badge"
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-cyan-950/50 border border-cyan-400/50 text-cyan-300 text-xs font-mono font-bold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="hidden sm:inline">VISITANTE</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    data-testid="btn-exit-guest"
                    className="px-3 py-1.5 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] hover:bg-[#163020] text-xs font-bold flex items-center space-x-1.5 transition-all"
                    title="Encerrar sessão visitante e entrar com uma conta"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Entrar</span>
                  </button>
                </>
              ) : (
                <>
                  {isAdmin && (
                    <Link
                      to="/admin/overview"
                      className="px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/40 text-amber-400 hover:bg-amber-400/20 text-xs font-mono font-bold flex items-center space-x-1 transition-all"
                      title="Acessar Painel de Controle Administrativo"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Admin</span>
                    </Link>
                  )}

                  <Link
                    to="/app/profile"
                    className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/50 transition-all"
                    title="Acessar Meu Perfil"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#102216] border border-[#39FF88]/60 flex items-center justify-center text-xs shrink-0">
                      {user?.avatar || '🎾'}
                    </div>
                    <span className="text-xs font-bold text-[#F5F7F5] max-w-[80px] sm:max-w-[100px] truncate">{user?.name}</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-[#8C9891] hover:text-rose-400 hover:border-rose-500/40 transition-all"
                    title="Sair da Conta"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu trigger */}
            <div className="flex lg:hidden items-center space-x-2">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-2 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-[#8C9891] hover:text-[#F5F7F5]"
                aria-label="Abrir menu de navegação"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-b border-[#1B3624] bg-[#07110B] p-4 space-y-2 animate-fadeIn">
            {/* Dashboard */}
            {!isGuest && (
              <NavLink
                to="/app/dashboard"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                    isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891]'
                  }`
                }
              >
                <Home className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>
            )}

            {/* Jogar */}
            <NavLink
              to="/app/play"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                  isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#39FF88]'
                }`
              }
            >
              <PlayCircle className="w-4 h-4" />
              <span>Jogar</span>
            </NavLink>

            {/* Desempenho no Menu Mobile (com Estatísticas e Evolução) */}
            {!isGuest && (
              <div className="space-y-1 pt-1 pb-1">
                <div className="px-3 py-1 text-[11px] font-mono text-[#8C9891] uppercase tracking-wider flex items-center space-x-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#39FF88]" />
                  <span>Desempenho</span>
                </div>
                <div className="pl-3 space-y-1 border-l-2 border-[#16C96B]/30 ml-3">
                  <NavLink
                    to="/app/statistics"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold ${
                        isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891] hover:text-[#F5F7F5]'
                      }`
                    }
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Estatísticas</span>
                  </NavLink>
                  <NavLink
                    to="/app/evolution"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold ${
                        isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891] hover:text-[#F5F7F5]'
                      }`
                    }
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Evolução</span>
                  </NavLink>
                </div>
              </div>
            )}

            {/* Academy */}
            <NavLink
              to="/app/academy"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                  isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891]'
                }`
              }
            >
              <GraduationCap className="w-4 h-4" />
              <span>Academy</span>
            </NavLink>

            {/* Histórico */}
            {!isGuest && (
              <NavLink
                to="/app/history"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                    isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891]'
                  }`
                }
              >
                <Clock className="w-4 h-4" />
                <span>Histórico</span>
              </NavLink>
            )}

            {/* Conquistas */}
            {!isGuest && (
              <NavLink
                to="/app/achievements"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                    isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891]'
                  }`
                }
              >
                <Trophy className="w-4 h-4" />
                <span>Conquistas</span>
              </NavLink>
            )}

            {/* Perfil */}
            {!isGuest && (
              <NavLink
                to="/app/profile"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                    isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891]'
                  }`
                }
              >
                <User className="w-4 h-4" />
                <span>Perfil</span>
              </NavLink>
            )}

            <div className="pt-3 border-t border-[#1B3624] flex items-center justify-between">
              <span className="text-xs font-mono text-[#8C9891]">
                {isGuest ? 'JOGANDO COMO VISITANTE' : user?.name}
              </span>
              <button onClick={handleLogout} className="text-xs text-rose-400 font-bold">
                {isGuest ? 'Entrar com Minha Conta' : 'Sair'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1B3624] py-4 text-center text-xs font-mono text-[#8C9891]">
        MOTION TENNIS © 2026 • Plataforma de Treinamento Esportivo e Gamificação
      </footer>

      {/* Modal Conectar Celular via QR Code */}
      <ConnectMobileModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
    </div>
  );
}
