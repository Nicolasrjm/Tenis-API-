import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Target, 
  Cpu, 
  Activity, 
  TrendingUp, 
  Radio, 
  Wifi, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  LogIn,
  QrCode,
  Smartphone
} from 'lucide-react';
import CourtTarget from '../components/CourtTarget';
import ConnectMobileModal from '../components/ConnectMobileModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showConnectModal, setShowConnectModal] = useState(false);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#07110B] text-[#F5F7F5] selection:bg-[#39FF88] selection:text-[#07110B]">
      
      {/* 3. SITE INSTITUCIONAL — Top Header */}
      <header className="border-b border-[#1B3624] bg-[#07110B]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#0C1A11] border border-[#39FF88]/40 flex items-center justify-center shadow-neon-sm">
              <svg className="w-5 h-5 text-[#39FF88]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18" strokeDasharray="2 2" strokeOpacity="0.6" />
                <path d="M3 12h18" strokeDasharray="2 2" strokeOpacity="0.6" />
                <circle cx="12" cy="12" r="3" fill="#39FF88" />
              </svg>
            </div>
            <div className="text-xl font-black tracking-wider">
              <span>MOTION </span>
              <span className="text-[#39FF88] text-glow-neon">TENNIS</span>
            </div>
          </Link>

          {/* Menu Institucional (Requirement 3: Produto, Como funciona, Tecnologia, Benefícios, Sobre) */}
          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-[#8C9891]">
            <button onClick={() => scrollTo('produto')} className="hover:text-[#F5F7F5] transition-colors">
              PRODUTO
            </button>
            <button onClick={() => scrollTo('como-funciona')} className="hover:text-[#F5F7F5] transition-colors">
              COMO FUNCIONA
            </button>
            <button onClick={() => scrollTo('tecnologia')} className="hover:text-[#F5F7F5] transition-colors">
              TECNOLOGIA
            </button>
            <button onClick={() => scrollTo('beneficios')} className="hover:text-[#F5F7F5] transition-colors">
              BENEFÍCIOS
            </button>
            <button onClick={() => scrollTo('sobre')} className="hover:text-[#F5F7F5] transition-colors">
              SOBRE
            </button>
            <Link
              to="/academy"
              data-testid="landing-nav-academy"
              className="text-[#39FF88] hover:text-[#F5F7F5] transition-colors font-bold"
            >
              ACADEMY (GRATUITA)
            </Link>
          </nav>

          {/* Botão Conectar Celular & Botão ENTRAR */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowConnectModal(true)}
              data-testid="btn-landing-connect-mobile"
              className="hidden sm:flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] text-xs font-bold hover:bg-[#163020] transition"
              title="Exibir QR Code para conectar aplicativo móvel"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Conectar Celular</span>
            </button>

            <Link
              to="/login"
              className="btn-neon px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center space-x-2 shadow-neon transition-transform active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>ENTRAR</span>
            </Link>
          </div>

        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 overflow-hidden border-b border-[#1B3624]">
        <div className="absolute inset-0 bg-tech-grid opacity-20 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#39FF88]/5 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#102216] border border-[#39FF88]/30 text-[#39FF88] text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-[#39FF88]"></span>
                <span>SISTEMA DE TREINAMENTO INTERATIVO</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight">
                <span className="text-[#F5F7F5]">MOTION </span>
                <span className="text-[#39FF88] text-glow-neon">TENNIS</span>
              </h1>

              <p className="text-2xl sm:text-3xl font-bold text-[#F5F7F5] leading-snug">
                Tecnologia que transforma cada jogada em evolução.
              </p>

              <p className="text-base sm:text-lg text-[#8C9891] max-w-xl mx-auto lg:mx-0">
                Treine precisão, acompanhe seu desempenho e transforme seus resultados em dados com nossa matriz de alvos calibrados e feedback em tempo real.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <button
                  onClick={() => scrollTo('como-funciona')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl btn-outline-neon font-bold text-xs tracking-wider uppercase"
                >
                  CONHEÇA O MOTION TENNIS
                </button>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon"
                >
                  <span>ACESSAR PLATAFORMA</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#1B3624]/80 max-w-xl mx-auto lg:mx-0 text-left">
                <div>
                  <div className="text-lg font-bold font-mono text-[#39FF88]">3 MODOS</div>
                  <div className="text-[11px] text-[#8C9891]">3 modos de treinamento</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-[#F5F7F5]">6 ALVOS</div>
                  <div className="text-[11px] text-[#8C9891]">6 alvos interativos</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-[#39FF88]">DADOS</div>
                  <div className="text-[11px] text-[#8C9891]">Histórico e estatísticas</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-[#F5F7F5]">ACADEMY</div>
                  <div className="text-[11px] text-[#8C9891]">Motion Tennis Academy</div>
                </div>
              </div>
            </div>

            {/* Visual Alvo Físico */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative p-4 rounded-3xl bg-[#0C1A11]/90 border border-[#1B3624] shadow-2xl w-full max-w-[460px]">
                <div className="absolute -top-3 left-6 px-3 py-0.5 rounded bg-[#102216] border border-[#39FF88]/50 text-[10px] font-mono text-[#39FF88]">
                  INTERFACE DIGITAL DE TREINAMENTO
                </div>
                <CourtTarget interactive={false} gameMode="single" activeSensorId={5} />
                <div className="mt-3 text-center text-xs font-mono text-[#8C9891]">
                  Projeção interativa e mapeamento de precisão em tempo real
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PRODUTO */}
      <section id="produto" className="py-20 bg-[#0A170F] border-b border-[#1B3624]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-mono tracking-widest text-[#39FF88] uppercase">
            EQUIPAMENTO & PLATAFORMA
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7F5] mt-2 max-w-3xl mx-auto">
            Físico. Digital. Inteligente.
          </h2>
          <p className="text-sm text-[#8C9891] mt-3 max-w-2xl mx-auto">
            O Motion Tennis não é apenas um software. É um equipamento físico real para quadras esportivas integrado a um centro de análise de dados.
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-6 rounded-2xl bg-[#0D1D13] border border-[#1B3624] space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#102216] border border-[#39FF88]/30 flex items-center justify-center text-[#39FF88] mb-3">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F5F7F5]">Painel de Alvo Interativo</h3>
              <p className="text-xs text-[#8C9891] leading-relaxed">
                Estrutura interativa com 6 alvos retangulares em matriz 3×2, calibrada para treinos de precisão e agilidade.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0D1D13] border border-[#1B3624] space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#102216] border border-[#39FF88]/30 flex items-center justify-center text-[#39FF88] mb-3">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F5F7F5]">Processamento e Pontuação Digital</h3>
              <p className="text-xs text-[#8C9891] leading-relaxed">
                Motor de cálculo de precisão, mapeamento de coordenadas e validação de regras em tempo real com persistência em SQLite.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0D1D13] border border-[#1B3624] space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#102216] border border-[#39FF88]/30 flex items-center justify-center text-[#39FF88] mb-3">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F5F7F5]">Análise de Performance</h3>
              <p className="text-xs text-[#8C9891] leading-relaxed">
                Dashboard com evolução técnica de 6 atributos, histórico de sessões, gamificação RPG e Motion Tennis Academy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 bg-[#07110B] border-b border-[#1B3624]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono font-bold tracking-widest text-[#39FF88] uppercase">
              METODOLOGIA
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#F5F7F5] mt-2">
              Como funciona o treinamento
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
              <span className="text-xs font-mono font-bold text-[#39FF88]">01</span>
              <h3 className="text-lg font-black text-[#F5F7F5] mt-1 mb-2">JOGUE</h3>
              <p className="text-xs text-[#8C9891]">O jogador desfere seus golpes no equipamento físico Motion Tennis.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
              <span className="text-xs font-mono font-bold text-[#39FF88]">02</span>
              <h3 className="text-lg font-black text-[#F5F7F5] mt-1 mb-2">IDENTIFIQUE</h3>
              <p className="text-xs text-[#8C9891]">Cada impacto nos 6 alvos interativos ou áreas neutras é validado com precisão.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
              <span className="text-xs font-mono font-bold text-[#39FF88]">03</span>
              <h3 className="text-lg font-black text-[#F5F7F5] mt-1 mb-2">REGISTRE</h3>
              <p className="text-xs text-[#8C9891]">O sistema calcula coordenadas, pontuação, velocidade e atualiza o banco local.</p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
              <span className="text-xs font-mono font-bold text-[#39FF88]">04</span>
              <h3 className="text-lg font-black text-[#F5F7F5] mt-1 mb-2">EVOLUA</h3>
              <p className="text-xs text-[#8C9891]">Acompanhe suas estatísticas, desbloqueie habilidades e acesse a Academy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TECNOLOGIA */}
      <section id="tecnologia" className="py-20 bg-[#0A170F] border-b border-[#1B3624]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold tracking-widest text-[#39FF88] uppercase">
              ENGENHARIA
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#F5F7F5] mt-2">
              Tecnologia Esportiva Robusta
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624] space-y-3">
              <h3 className="text-lg font-bold text-[#39FF88] flex items-center space-x-2">
                <Radio className="w-5 h-5" />
                <span>Alvos com Posição Calibrada</span>
              </h3>
              <p className="text-xs text-[#8C9891] leading-relaxed">
                Cada alvo retangular possui dimensões e espaçamento de 30 cm padronizados, garantindo precisão milimétrica e calibração biomecânica para jogadores de todos os níveis.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624] space-y-3">
              <h3 className="text-lg font-bold text-[#39FF88] flex items-center space-x-2">
                <Wifi className="w-5 h-5" />
                <span>Comunicação em Tempo Real</span>
              </h3>
              <p className="text-xs text-[#8C9891] leading-relaxed">
                Sincronização instantânea via API e WebSocket local com persistência no banco SQLite, garantindo feedback sonoro e visual imediato.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section id="beneficios" className="py-20 bg-[#07110B] border-b border-[#1B3624]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-mono font-bold tracking-widest text-[#39FF88] uppercase">
            RESULTADOS REAIS
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#F5F7F5] mt-2">
            Benefícios para Treinadores e Atletas
          </h2>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
            <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624] space-y-2">
              <CheckCircle2 className="w-5 h-5 text-[#39FF88]" />
              <h4 className="text-sm font-bold text-[#F5F7F5]">Precisão Comprovada</h4>
              <p className="text-xs text-[#8C9891]">Dados concretos em vez de palpites visuais sobre o ponto de queda da bola.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624] space-y-2">
              <CheckCircle2 className="w-5 h-5 text-[#39FF88]" />
              <h4 className="text-sm font-bold text-[#F5F7F5]">Gamificação e Retenção</h4>
              <p className="text-xs text-[#8C9891]">Atletas mais motivados através de níveis, recompensas de XP e desafios cronometrados.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624] space-y-2">
              <CheckCircle2 className="w-5 h-5 text-[#39FF88]" />
              <h4 className="text-sm font-bold text-[#F5F7F5]">Gestão de Equipamentos</h4>
              <p className="text-xs text-[#8C9891]">Painel administrativo para academias e clubes monitorarem múltiplos equipamentos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="py-16 bg-[#0A170F] border-b border-[#1B3624] text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-4">
          <h3 className="text-2xl font-black text-[#F5F7F5]">Sobre o Motion Tennis</h3>
          <p className="text-xs text-[#8C9891] leading-relaxed">
            Desenvolvido para conectar a prática real em quadra com a precisão dos dados digitais. Operando 100% offline em localhost com banco SQLite, sem dependência de serviços externos.
          </p>
          <div className="pt-4">
            <Link
              to="/login"
              className="btn-neon px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider inline-flex items-center space-x-2 shadow-neon"
            >
              <span>ACESSAR PLATAFORMA</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-[#050B07] text-[#8C9891] text-xs font-mono text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>MOTION TENNIS © 2026 • Plataforma Esportiva e Tecnológica</span>
          <Link to="/login" className="text-[#39FF88] hover:underline font-bold">
            Área de Login
          </Link>
        </div>
      </footer>

      {/* QR Code Modal para Conectar Celular */}
      <ConnectMobileModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
    </div>
  );
}
