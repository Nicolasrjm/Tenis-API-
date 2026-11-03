import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Cpu, 
  Users, 
  Activity, 
  Radio, 
  FileText, 
  Settings, 
  ArrowLeft, 
  LogOut, 
  ShieldCheck,
  GraduationCap,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Rotas primárias de alta frequência
  const primaryNav = [
    { to: '/admin/overview', label: 'Visão Geral', icon: LayoutDashboard },
    { to: '/admin/academy', label: 'Academy', icon: GraduationCap },
    { to: '/admin/equipments', label: 'Equipamentos', icon: Cpu },
    { to: '/admin/users', label: 'Usuários', icon: Users },
    { to: '/admin/sessions', label: 'Sessões', icon: Activity },
  ];

  // Rotas secundárias agrupadas no menu compacto "Sistema"
  const secondaryNav = [
    { to: '/admin/sensors', label: 'Sensores', icon: Radio, desc: 'Hardware & Calibração' },
    { to: '/admin/reports', label: 'Relatórios', icon: FileText, desc: 'Métricas e Exportação' },
    { to: '/admin/settings', label: 'Configurações', icon: Settings, desc: 'Ajustes Operacionais' },
  ];

  const allNav = [...primaryNav, ...secondaryNav];

  const isSecondaryActive = secondaryNav.some(item => location.pathname.startsWith(item.to));

  // Fecha dropdown ao clicar fora ou ao pressionar ESC
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Fecha menus ao mudar de rota
  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#DCE3E8] dark:bg-[#101820] text-[#142B3D] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Admin Bar */}
      <header className="sticky top-0 z-50 bg-[#142B3D]/95 dark:bg-[#0D1B2A]/98 backdrop-blur border-b border-[#1C3A52] dark:border-[#344653] text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16 gap-2">
            
            {/* Admin Brand */}
            <div className="flex items-center space-x-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="text-sm sm:text-base font-black tracking-wider leading-none">
                  <span className="text-[#F5F7F5]">MOTION TENNIS </span>
                  <span className="text-amber-400">ADMIN</span>
                </div>
                <span className="text-[9px] text-[#8C9891] tracking-widest uppercase font-mono mt-0.5">
                  Gestão & Hardware
                </span>
              </div>
            </div>

            {/* Desktop Admin Nav: 5 Primárias + Menu Compacto "Sistema" */}
            <nav className="hidden lg:flex items-center space-x-1 font-mono">
              {primaryNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-amber-400/15 text-amber-400 border border-amber-400/40 font-bold shadow-sm'
                          : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                      }`
                    }
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              {/* Menu Compacto "Sistema" (Sensores, Relatórios, Configurações) */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  data-testid="admin-btn-sistema-dropdown"
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                  aria-controls="admin-dropdown-menu"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all outline-none ${
                    isSecondaryActive
                      ? 'bg-amber-400/15 text-amber-400 border border-amber-400/40 font-bold shadow-sm'
                      : dropdownOpen
                      ? 'bg-[#0C1A11] text-[#F5F7F5] border border-amber-400/30'
                      : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Sistema</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      dropdownOpen ? 'rotate-180 text-amber-400' : 'text-[#8C9891]'
                    }`}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    id="admin-dropdown-menu"
                    role="menu"
                    data-testid="admin-dropdown-menu"
                    className="absolute top-full right-0 mt-2 w-56 rounded-2xl bg-[#09150E] border border-amber-400/40 shadow-2xl p-1.5 z-50 flex flex-col space-y-1 backdrop-blur-md animate-fadeIn"
                  >
                    {secondaryNav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          role="menuitem"
                          onClick={() => setDropdownOpen(false)}
                          className={({ isActive }) =>
                            `flex items-start space-x-2.5 p-2 rounded-xl text-xs transition-all ${
                              isActive
                                ? 'bg-amber-400/15 text-amber-400 border border-amber-400/40 font-bold shadow-sm'
                                : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                            }`
                          }
                        >
                          <Icon className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-[#F5F7F5]">{item.label}</span>
                            <span className="text-[10px] text-[#8C9891] font-normal font-mono">
                              {item.desc}
                            </span>
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>

            {/* Right Tools - shrink-0 garante que NUNCA será cortado ou empurrado */}
            <div className="flex items-center space-x-2 shrink-0">
              <ThemeToggle />

              <Link
                to="/app/dashboard"
                data-testid="admin-link-player-area"
                className="px-2.5 py-1.5 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] hover:bg-[#163020] text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm shrink-0"
                title="Acessar Área do Jogador"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Área do Jogador</span>
              </Link>

              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-xs font-mono shrink-0">
                <span className="text-amber-400">👑</span>
                <span className="font-bold text-[#F5F7F5] max-w-[80px] truncate">{user?.name || 'Admin'}</span>
              </div>

              {/* Botão Sair / Logout SEMPRE Visível */}
              <button
                onClick={handleLogout}
                data-testid="admin-btn-logout"
                className="px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500/50 text-rose-200 hover:text-white text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                title="Encerrar sessão administrativa"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Sair</span>
              </button>

              {/* Botão Hambúrguer Mobile / Tablet (< 1024px) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="p-1.5 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-[#8C9891] hover:text-[#F5F7F5] lg:hidden"
                aria-label="Abrir menu administrativo"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile / Tablet Drawer Menu (< 1024px) */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#1B3624] bg-[#07110B] px-4 py-3 space-y-1 font-mono animate-fadeIn">
            <div className="text-[10px] text-[#8C9891] uppercase px-2 py-1 font-bold">Menu Administrativo</div>
            <div className="grid grid-cols-2 gap-1.5">
              {allNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-xl text-xs flex items-center space-x-2 transition ${
                        isActive
                          ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40 font-bold'
                          : 'bg-[#0C1A11] text-[#8C9891] hover:text-[#F5F7F5] border border-[#1B3624]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
            <div className="pt-2 border-t border-[#1B3624] flex items-center justify-between">
              <Link
                to="/app/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs text-[#39FF88] hover:underline flex items-center space-x-1 py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar à Área do Jogador</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center space-x-1 py-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-[#B8C6D0] dark:border-[#344653] py-4 text-center text-xs font-mono text-[#475569] dark:text-[#A8BAC8]">
        Motion Tennis Admin Console • Gestão de Equipamentos Físicos & Jogadores
      </footer>

    </div>
  );
}
