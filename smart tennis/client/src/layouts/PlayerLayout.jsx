import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
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
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConnectMobileModal from '../components/ConnectMobileModal';

export default function PlayerLayout() {
  const { user, isGuest, logout, exitGuest, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const handleLogout = async () => {
    if (isGuest) {
      await exitGuest();
    } else {
      await logout();
    }
    navigate('/login');
  };

  // Visitantes veem a aba de Jogo e a Motion Tennis Academy gratuita (sem acesso a Dashboard, Estatísticas, Histórico, XP ou Conquistas)
  const navItems = isGuest
    ? [
        { to: '/app/play', label: 'Jogar', icon: PlayCircle, highlight: true },
        { to: '/app/academy', label: 'Academy', icon: GraduationCap },
      ]
    : [
        { to: '/app/dashboard', label: 'Dashboard', icon: Home },
        { to: '/app/play', label: 'Jogar', icon: PlayCircle, highlight: true },
        { to: '/app/statistics', label: 'Estatísticas', icon: BarChart2 },
        { to: '/app/evolution', label: 'Evolução', icon: GitFork },
        { to: '/app/academy', label: 'Academy', icon: GraduationCap },
        { to: '/app/history', label: 'Histórico', icon: Clock },
        { to: '/app/achievements', label: 'Conquistas', icon: Trophy },
        { to: '/app/profile', label: 'Perfil', icon: User },
      ];

  return (
    <div className="min-h-screen bg-[#07110B] text-[#F5F7F5] flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[#07110B]/95 backdrop-blur border-b border-[#1B3624]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={isGuest ? '/app/play' : '/app/dashboard'} className="flex items-center space-x-3 group">
              <div className="w-8 h-8 rounded-lg bg-[#0C1A11] border border-[#39FF88]/40 flex items-center justify-center shadow-neon-sm">
                <svg className="w-5 h-5 text-[#39FF88]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18" strokeDasharray="2 2" strokeOpacity="0.6" />
                  <path d="M3 12h18" strokeDasharray="2 2" strokeOpacity="0.6" />
                  <circle cx="12" cy="12" r="3" fill="#39FF88" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-wider leading-none">
                  <span>MOTION </span>
                  <span className="text-[#39FF88] text-glow-neon">TENNIS</span>
                </span>
                <span className="text-[9px] text-[#8C9891] tracking-widest uppercase font-mono">
                  {isGuest ? 'Modo Visitante' : 'Área do Jogador'}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                        isActive
                          ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                          : item.highlight
                          ? 'bg-[#39FF88]/10 text-[#39FF88] hover:bg-[#39FF88]/20'
                          : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                      }`
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Right side: Equipment + Mobile QR + User/Guest + Logout */}
            <div className="hidden sm:flex items-center space-x-3">
              <button
                onClick={() => setShowConnectModal(true)}
                data-testid="btn-connect-mobile-modal"
                className="px-2.5 py-1 rounded-xl bg-[#0C1A11] border border-[#39FF88]/40 hover:bg-[#122418] text-[#39FF88] text-xs font-semibold flex items-center space-x-1.5 transition-all"
                title="Conectar aplicativo celular via QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Conectar Celular</span>
              </button>

              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#0C1A11] border border-[#1B3624] text-[10px] font-mono text-[#8C9891]">
                <Radio className="w-3 h-3 text-[#39FF88] animate-pulse" />
                <span>{user?.equipment?.name || 'MOTION TENNIS #001'}</span>
              </div>

              {isGuest ? (
                <>
                  <div
                    data-testid="guest-mode-badge"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/50 border border-cyan-400/50 text-cyan-300 text-xs font-mono font-bold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>JOGANDO COMO VISITANTE</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    data-testid="btn-exit-guest"
                    className="px-3 py-1.5 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] hover:bg-[#163020] text-xs font-bold flex items-center space-x-1.5 transition-all"
                    title="Encerrar sessão visitante e entrar com uma conta"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Entrar com Minha Conta</span>
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
                      <span>Painel Admin</span>
                    </Link>
                  )}

                  <Link
                    to="/app/profile"
                    className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/50 transition-all"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#102216] border border-[#39FF88]/60 flex items-center justify-center text-xs">
                      {user?.avatar || '🎾'}
                    </div>
                    <span className="text-xs font-bold text-[#F5F7F5] max-w-[100px] truncate">{user?.name}</span>
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
                className="p-2 rounded-lg bg-[#0C1A11] border border-[#1B3624] text-[#8C9891]"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-b border-[#1B3624] bg-[#07110B] p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                      isActive ? 'bg-[#102216] text-[#39FF88]' : 'text-[#8C9891]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <div className="pt-2 border-t border-[#1B3624] flex items-center justify-between">
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
