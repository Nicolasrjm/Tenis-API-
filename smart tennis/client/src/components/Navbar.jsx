import React, { useState } from 'react';
import { 
  Home, 
  PlayCircle, 
  BarChart2, 
  GitFork, 
  Award, 
  Trophy, 
  Clock, 
  User, 
  Settings, 
  Cpu, 
  Radio,
  Menu,
  X
} from 'lucide-react';

export default function Navbar({ currentTab, setTab, player, systemStatus, onOpenLanding }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'play', label: 'Jogar', icon: PlayCircle, highlight: true },
    { id: 'performance', label: 'Meu Desempenho', icon: BarChart2 },
    { id: 'evolution', label: 'Minha Evolução', icon: GitFork },
    { id: 'trainings', label: 'Treinamentos', icon: Award },
    { id: 'achievements', label: 'Conquistas', icon: Trophy },
    { id: 'history', label: 'Histórico', icon: Clock },
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const isSimulated = !systemStatus?.hardwareConnected;

  return (
    <header className="sticky top-0 z-50 bg-[#07110B]/95 backdrop-blur-md border-b border-[#1B3624]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onOpenLanding ? onOpenLanding() : setTab('dashboard')}>
            <div className="relative w-9 h-9 rounded-lg bg-[#0C1A11] border border-[#39FF88]/40 flex items-center justify-center shadow-neon-sm overflow-hidden group">
              <div className="absolute inset-0 bg-[#39FF88]/10 group-hover:bg-[#39FF88]/20 transition-colors"></div>
              
              <svg className="w-6 h-6 text-[#39FF88]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18" strokeDasharray="2 2" strokeOpacity="0.6" />
                <path d="M3 12h18" strokeDasharray="2 2" strokeOpacity="0.6" />
                <circle cx="12" cy="12" r="3" fill="#39FF88" />
              </svg>
            </div>
            
            <div className="flex flex-col">
              <div className="text-xl font-black tracking-wider leading-none">
                <span className="text-[#F5F7F5]">MOTION </span>
                <span className="text-[#39FF88] text-glow-neon">TENNIS</span>
              </div>
              <span className="text-[10px] text-[#8C9891] tracking-widest uppercase font-mono">
                Sports Tech Platform
              </span>
            </div>
          </div>

          
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/40 shadow-neon-sm'
                      : item.highlight
                      ? 'bg-[#39FF88]/10 text-[#39FF88] hover:bg-[#39FF88]/20'
                      : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#102216]/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#39FF88]' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          
          <div className="hidden sm:flex items-center space-x-4">
            
            
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              isSimulated 
                ? 'bg-[#122419] border-[#295437] text-[#8C9891]'
                : 'bg-[#39FF88]/10 border-[#39FF88]/40 text-[#39FF88]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isSimulated ? 'bg-amber-400 animate-pulse' : 'bg-[#39FF88] shadow-neon-sm'
              }`}></span>
              <span>{isSimulated ? 'Modo simulação' : 'Sistema conectado'}</span>
            </div>

            
            {player && (
              <div 
                onClick={() => setTab('profile')}
                className="flex items-center space-x-2.5 px-3 py-1 rounded-lg bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/50 cursor-pointer transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-[#102216] border border-[#39FF88]/60 flex items-center justify-center text-sm shadow-neon-sm">
                  {player.avatar || '🎾'}
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1.5 leading-none">
                    <span className="text-xs font-bold text-[#F5F7F5]">{player.name}</span>
                    <span className="text-[10px] font-mono font-bold text-[#39FF88] bg-[#39FF88]/15 px-1 py-0.5 rounded">
                      LV.{player.level}
                    </span>
                  </div>
                  <div className="w-16 bg-[#1B3624] h-1 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="bg-[#39FF88] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (player.xp / player.xp_next) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          
          <div className="flex lg:hidden items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-[#0C1A11] border border-[#1B3624] text-[#8C9891] hover:text-[#39FF88]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#1B3624] bg-[#07110B]/98 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-[#102216] text-[#39FF88] border border-[#39FF88]/30'
                    : 'text-[#8C9891] hover:text-[#F5F7F5] hover:bg-[#0C1A11]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
