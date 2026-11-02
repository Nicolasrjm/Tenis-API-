import React from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Cpu, 
  Users, 
  Activity, 
  Radio, 
  FileText, 
  Settings, 
  GraduationCap,
  ArrowLeft, 
  LogOut, 
  ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminNav = [
    { to: '/admin/overview', label: 'Visão Geral', icon: LayoutDashboard },
    { to: '/admin/academy', label: 'Gerenciar Academy', icon: GraduationCap },
    { to: '/admin/equipments', label: 'Equipamentos', icon: Cpu },
    { to: '/admin/users', label: 'Usuários', icon: Users },
    { to: '/admin/sessions', label: 'Sessões', icon: Activity },
    { to: '/admin/sensors', label: 'Sensores', icon: Radio },
    { to: '/admin/reports', label: 'Relatórios', icon: FileText },
    { to: '/admin/settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#060D08] text-[#F5F7F5] flex flex-col">
      
      {/* Top Admin Bar */}
      <header className="sticky top-0 z-50 bg-[#08120B]/98 backdrop-blur border-b border-[#295437]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Admin Brand */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/40 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="text-base font-black tracking-wider leading-none">
                  <span className="text-[#F5F7F5]">MOTION TENNIS </span>
                  <span className="text-amber-400">ADMIN</span>
                </div>
                <span className="text-[9px] text-[#8C9891] tracking-widest uppercase font-mono mt-0.5">
                  Gestão & Hardware
                </span>
              </div>
            </div>

            {/* Admin Nav */}
            <nav className="hidden md:flex items-center space-x-1 font-mono">
              {adminNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-amber-400/15 text-amber-400 border border-amber-400/40'
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

            {/* Right Tools */}
            <div className="flex items-center space-x-3">
              <Link
                to="/app/dashboard"
                className="px-3 py-1.5 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] hover:bg-[#39FF88]/10 text-xs font-bold flex items-center space-x-1.5 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Área do Jogador</span>
              </Link>

              <div className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-xs font-mono">
                <span className="text-amber-400">👑</span>
                <span className="font-bold text-[#F5F7F5]">{user?.name}</span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-[#8C9891] hover:text-rose-400 transition-all"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Mobile admin menu */}
        <div className="md:hidden border-t border-[#1B3624] px-4 py-2 flex overflow-x-auto space-x-2">
          {adminNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap flex items-center space-x-1 ${
                    isActive ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40' : 'text-[#8C9891]'
                  }`
                }
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-[#1B3624] py-4 text-center text-xs font-mono text-[#8C9891]">
        Motion Tennis Admin Console • Gestão de Equipamentos Físicos & Jogadores
      </footer>

    </div>
  );
}
