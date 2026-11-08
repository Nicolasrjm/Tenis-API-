import React, { useState, useEffect } from 'react';
import { Settings, Cpu, HardDrive, Wifi, Radio, Send, CheckCircle2, ShieldCheck, Terminal, Smartphone, QrCode } from 'lucide-react';
import { api } from '../services/api';
import ConnectMobileModal from '../components/ConnectMobileModal';

export default function SettingsPage() {
  const [status, setStatus] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [hwX, setHwX] = useState(50);
  const [hwY, setHwY] = useState(50);
  const [hwSpeed, setHwSpeed] = useState(88);
  const [hwSensor, setHwSensor] = useState('ESP32-PIEZO-01');
  const [hwResponse, setHwResponse] = useState(null);
  const [sendingHw, setSendingHw] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.getStatus();
      setStatus(res);
    } catch (e) {
      console.error('Erro ao verificar status:', e);
    }
  };

  const handleSendHardwareTest = async (e) => {
    e.preventDefault();
    setSendingHw(true);
    setHwResponse(null);
    try {
      const res = await api.sendHardwareHit({
        x: Number(hwX),
        y: Number(hwY),
        speed: Number(hwSpeed),
        sensor_id: hwSensor,
        timestamp: new Date().toISOString()
      });
      setHwResponse({ success: true, data: res });
    } catch (err) {
      setHwResponse({ success: false, error: err.message });
    } finally {
      setSendingHw(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
      
      
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex items-center space-x-3">
        <Settings className="w-6 h-6 text-[#39FF88]" />
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5]">Configurações & Diagnóstico do Sistema</h1>
          <p className="text-xs text-[#8C9891]">Monitoramento de servidor local, banco de dados e testes de hardware.</p>
        </div>
      </div>

      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        
        <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-[#8C9891]">SERVIDOR LOCAL</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#39FF88] shadow-neon"></span>
          </div>
          <div className="text-xl font-bold font-mono text-[#F5F7F5]">
            ● Online
          </div>
          <div className="text-[11px] font-mono text-[#8C9891] mt-1">
            Porta: {status?.server?.port || 3000} (127.0.0.1)
          </div>
        </div>

        
        <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-[#8C9891]">BANCO DE DADOS</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#39FF88] shadow-neon"></span>
          </div>
          <div className="text-xl font-bold font-mono text-[#F5F7F5]">
            ● SQLite Conectado
          </div>
          <div className="text-[11px] font-mono text-[#8C9891] mt-1 truncate">
            Arquivo: smart_tennis.db
          </div>
        </div>

        
        <div className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-[#8C9891]">SENSORES</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          </div>
          <div className="text-xl font-bold font-mono text-[#39FF88]">
            ● Modo Simulação
          </div>
          <div className="text-[11px] font-mono text-[#8C9891] mt-1">
            Endpoint REST & WS Ativo
          </div>
        </div>

      </div>

      
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#122418] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88]">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F5F7F5]">
              Conexão do Aplicativo Celular (Android)
            </h2>
            <p className="text-xs text-[#8C9891] mt-0.5 font-mono">
              IP do Notebook: <span className="text-[#39FF88] font-bold">{status?.server?.lanUrl || 'http://192.168.0.27:3000'}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowConnectModal(true)}
          data-testid="btn-open-qr-settings"
          className="px-4 py-2.5 rounded-xl bg-[#14301D] hover:bg-[#1C4229] border border-[#39FF88]/40 text-[#39FF88] text-xs font-bold flex items-center space-x-2 transition"
        >
          <QrCode className="w-4 h-4" />
          <span>Exibir QR Code</span>
        </button>
      </div>

      
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#F5F7F5] flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-[#39FF88]" />
            <span>Simulador de Requisição de Hardware (ESP32 / Arduino)</span>
          </h2>
          <p className="text-xs text-[#8C9891] mt-1">
            Teste o endpoint <code className="text-[#39FF88] font-mono">POST /api/hardware/hit</code> enviando uma jogada com coordenadas e velocidade simulando um sensor físico.
          </p>
        </div>

        <form onSubmit={handleSendHardwareTest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono text-xs">
            
            <div>
              <label className="block text-[#8C9891] mb-1">COORDENADA X (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={hwX}
                onChange={(e) => setHwX(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] focus:border-[#39FF88] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[#8C9891] mb-1">COORDENADA Y (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={hwY}
                onChange={(e) => setHwY(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] focus:border-[#39FF88] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[#8C9891] mb-1">VELOCIDADE (KM/H)</label>
              <input
                type="number"
                min="30"
                max="200"
                value={hwSpeed}
                onChange={(e) => setHwSpeed(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] focus:border-[#39FF88] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[#8C9891] mb-1">ID DO SENSOR</label>
              <input
                type="text"
                value={hwSensor}
                onChange={(e) => setHwSensor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#07110B] border border-[#1B3624] text-[#F5F7F5] focus:border-[#39FF88] focus:outline-none"
                required
              />
            </div>

          </div>

          <button
            type="submit"
            disabled={sendingHw}
            className="w-full py-3.5 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-neon"
          >
            <Send className="w-4 h-4" />
            <span>{sendingHw ? 'DISPARANDO...' : 'ENVIAR JOGADA DE HARDWARE TESTE'}</span>
          </button>
        </form>

        {hwResponse && (
          <div className="p-4 rounded-xl bg-[#07110B] border border-[#39FF88]/40 text-xs font-mono">
            <span className="text-[#39FF88] font-bold">RESPOSTA DA API:</span>
            <pre className="mt-2 text-[#8C9891] overflow-x-auto">
              {JSON.stringify(hwResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>

      
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-3">
        <h3 className="text-sm font-bold text-[#F5F7F5]">Instruções para Conexão Física (Arduino / ESP32)</h3>
        <p className="text-xs text-[#8C9891] leading-relaxed">
          Consulte o arquivo <code className="text-[#39FF88] font-mono">HARDWARE_INTEGRATION.md</code> na raiz do projeto para esquemas elétricos de sensores piezoelétricos, código fonte em C++ pronto para gravar no ESP32, e exemplos de scripts Python para ponte Serial via USB.
        </p>
      </div>

      
      <ConnectMobileModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
    </div>
  );
}
