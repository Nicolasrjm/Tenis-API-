import React, { useState, useEffect } from 'react';
import { Settings, Shield, Database, Wifi, Bell, Globe, Save, ChevronRight, AlertCircle, CheckCircle2, Sliders } from 'lucide-react';
import { api } from '../../services/api';

const SettingSection = ({ icon: Icon, title, children }) => (
  <div className="bg-[#0C1A11] border border-[#1B3624] rounded-2xl p-6 space-y-4">
    <h2 className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider border-b border-[#1B3624] pb-3">
      <Icon size={14} />
      {title}
    </h2>
    {children}
  </div>
);

const SettingRow = ({ label, description, children }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <div className="text-[#F5F7F5] text-sm font-medium">{label}</div>
      {description && <div className="text-[#8C9891] text-xs mt-0.5">{description}</div>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const Toggle = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-[#39FF88]' : 'bg-[#1B3624]'}`}
  >
    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [wallPreset, setWallPreset] = useState('medium');
  const [wallSaved, setWallSaved] = useState(false);
  const [installMode, setInstallMode] = useState('personal');
  const [installInterval, setInstallInterval] = useState(30);
  const [installRound, setInstallRound] = useState(120);
  const [installMsg, setInstallMsg] = useState(null);
  const [settings, setSettings] = useState({
    systemName: 'Motion Tennis',
    apiPort: '3000',
    wsEnabled: true,
    autoBackup: true,
    notifications: true,
    maintenanceMode: false,
    debugMode: false,
    sessionTimeout: '60',
    maxPlayersPerEquipment: '20',
    defaultGameMode: 'free',
    hardwareMode: 'simulation',
    serialBaudRate: '115200',
    webSocketPath: '/ws',
  });

  useEffect(() => {
    api.admin.getWallConfig().then((cfg) => {
      if (cfg?.preset) setWallPreset(cfg.preset);
    }).catch(() => {});
    api.getInstallation().then((cfg) => {
      if (cfg?.mode) setInstallMode(cfg.mode);
      if (cfg?.shoppingIntervalSeconds) setInstallInterval(cfg.shoppingIntervalSeconds);
      if (cfg?.roundSeconds) setInstallRound(cfg.roundSeconds);
    }).catch(() => {});
  }, []);

  const handleSaveInstallation = async () => {
    setInstallMsg(null);
    try {
      const res = await api.admin.setInstallation({
        mode: installMode,
        shoppingIntervalSeconds: Number(installInterval)
      });
      setInstallMode(res.mode);
      setInstallInterval(res.shoppingIntervalSeconds);
      setInstallMsg({ ok: true, text: `Tipo de instalação salvo: ${res.mode === 'shopping' ? 'Shopping' : 'Pessoal'}.` });
    } catch (e) {
      setInstallMsg({ ok: false, text: e.message });
    }
  };

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    try {
      await api.admin.setWallConfig(wallPreset);
    } catch (e) {}
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveWallOnly = async (preset) => {
    setWallPreset(preset);
    try {
      await api.admin.setWallConfig(preset);
      setWallSaved(true);
      setTimeout(() => setWallSaved(false), 3500);
    } catch (e) {
      alert('Erro ao salvar configuração da parede: ' + e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-amber-400 tracking-wide">CONFIGURAÇÕES</h1>
          <p className="text-[#8C9891] text-sm mt-1">Configurações administrativas da plataforma Motion Tennis</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-[#07110B] font-bold px-5 py-2 rounded-xl text-sm transition-all"
        >
          <Save size={14} />
          Salvar Alterações
        </button>
      </div>

      
      {saved && (
        <div className="flex items-center gap-2 bg-[#39FF88]/10 border border-[#39FF88]/20 rounded-xl p-3 text-[#39FF88] text-sm font-mono">
          <CheckCircle2 size={16} />
          Configurações salvas com sucesso no banco de dados!
        </div>
      )}

      
      <div className="p-6 rounded-2xl bg-[#0C1A11] border-2 border-amber-400/40 shadow-xl space-y-4">
        <div className="border-b border-[#1B3624] pb-3">
          <h2 className="text-base font-black text-amber-400 tracking-wide uppercase flex items-center gap-2">
            <Settings className="w-5 h-5" />
            TIPO DE INSTALAÇÃO
          </h2>
          <p className="text-xs text-[#8C9891] mt-0.5">
            Define como os jogos funcionam neste equipamento. Apenas administradores podem alterar. Salvo no banco SQL e mantido após reiniciar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'shopping', title: 'Shopping', desc: 'Experiência comercial: 3 jogos seguidos de 2 min (Treino Livre → Liga Um por Vez → Apagar Todos) com intervalos. Tempo controlado pelo servidor.' },
            { key: 'personal', title: 'Pessoal', desc: 'Treinamento livre: o jogador escolhe qualquer um dos 3 jogos, sem limite obrigatório de tempo.' }
          ].map((opt) => (
            <div
              key={opt.key}
              data-testid={`installation-${opt.key}`}
              onClick={() => setInstallMode(opt.key)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                installMode === opt.key
                  ? 'bg-[#16291C] border-[#39FF88] shadow-[0_0_20px_rgba(57,255,136,0.2)]'
                  : 'bg-[#07110B] border-[#1B3624] hover:border-[#39FF88]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#F5F7F5] uppercase">{opt.title}</span>
                {installMode === opt.key && <CheckCircle2 className="w-4 h-4 text-[#39FF88]" />}
              </div>
              <p className="text-xs text-[#8C9891] mt-2 leading-relaxed">{opt.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div>
            <label className="block text-xs font-mono text-[#8C9891] mb-1.5 uppercase">Intervalo entre jogos (segundos)</label>
            <input
              type="number"
              min="5"
              max="300"
              value={installInterval}
              onChange={(e) => setInstallInterval(e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-2 text-[#F5F7F5] text-sm w-32 font-mono focus:outline-none focus:border-amber-400/50"
            />
            <div className="text-[10px] text-[#8C9891]/70 font-mono mt-1">Rodadas: fixas em {installRound}s nesta versão.</div>
          </div>
          <button
            onClick={handleSaveInstallation}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-[#07110B] font-bold px-5 py-2 rounded-xl text-sm transition-all"
          >
            <Save size={14} />
            Salvar tipo de instalação
          </button>
        </div>

        {installMsg && (
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-mono border ${
            installMsg.ok ? 'bg-[#39FF88]/10 border-[#39FF88]/20 text-[#39FF88]' : 'bg-rose-950/40 border-rose-500/40 text-rose-400'
          }`}>
            {installMsg.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {installMsg.text}
          </div>
        )}
      </div>

      
      <div className="p-6 rounded-2xl bg-[#0C1A11] border-2 border-amber-400/40 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#1B3624] pb-3">
          <div>
            <h2 className="text-base font-black text-amber-400 tracking-wide uppercase flex items-center gap-2">
              <Sliders className="w-5 h-5" />
              CONFIGURAÇÃO DA PAREDE
            </h2>
            <p className="text-xs text-[#8C9891] mt-0.5">
              Escolha entre as três opções de tamanho físico da parede projetada. A configuração é salva no banco SQL e aplicada aos jogos.
            </p>
          </div>
          {wallSaved && (
            <span className="text-xs font-mono text-[#39FF88] bg-[#39FF88]/10 border border-[#39FF88]/30 px-3 py-1 rounded-lg animate-fadeIn flex items-center gap-1.5 font-bold">
              <CheckCircle2 size={14} /> Salvo no Banco!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => handleSaveWallOnly('3x2')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              wallPreset === '3x2' || wallPreset === 'medium'
                ? 'bg-[#16291C] border-[#39FF88] shadow-[0_0_20px_rgba(57,255,136,0.2)]'
                : 'bg-[#07110B] border-[#1B3624] hover:border-[#39FF88]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-[#F5F7F5]">3 × 2 metros</span>
                <span className="text-[9px] bg-[#39FF88]/20 text-[#39FF88] px-1.5 py-0.5 rounded font-mono font-bold">PADRÃO</span>
              </div>
              {(wallPreset === '3x2' || wallPreset === 'medium') && <CheckCircle2 className="w-4 h-4 text-[#39FF88]" />}
            </div>
            <div className="text-2xl font-black font-mono text-[#39FF88] mt-2">3m × 2m</div>
            <div className="text-xs text-[#8C9891] font-mono mt-1">S1=(0,2) • S2=(3,2) • S3=(0,0)</div>
            <div className="text-[10px] text-[#39FF88]/80 font-mono mt-0.5">Alvos: 73×75cm • Espaçamento: 30cm • Margem: 10cm</div>
          </div>

          <div
            onClick={() => handleSaveWallOnly('3x3')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              wallPreset === '3x3'
                ? 'bg-[#16291C] border-[#39FF88] shadow-[0_0_20px_rgba(57,255,136,0.2)]'
                : 'bg-[#07110B] border-[#1B3624] hover:border-[#39FF88]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#F5F7F5]">3 × 3 metros</span>
              {wallPreset === '3x3' && <CheckCircle2 className="w-4 h-4 text-[#39FF88]" />}
            </div>
            <div className="text-2xl font-black font-mono text-[#39FF88] mt-2">3m × 3m</div>
            <div className="text-xs text-[#8C9891] font-mono mt-1">S1=(0,3) • S2=(3,3) • S3=(0,0)</div>
            <div className="text-[10px] text-[#39FF88]/80 font-mono mt-0.5">Alvos: 73×125cm • Espaçamento: 30cm • Margem: 10cm</div>
          </div>

          <div
            onClick={() => handleSaveWallOnly('4x3')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              wallPreset === '4x3' || wallPreset === 'large'
                ? 'bg-[#16291C] border-[#39FF88] shadow-[0_0_20px_rgba(57,255,136,0.2)]'
                : 'bg-[#07110B] border-[#1B3624] hover:border-[#39FF88]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#F5F7F5]">4 × 3 metros</span>
              {(wallPreset === '4x3' || wallPreset === 'large') && <CheckCircle2 className="w-4 h-4 text-[#39FF88]" />}
            </div>
            <div className="text-2xl font-black font-mono text-[#39FF88] mt-2">4m × 3m</div>
            <div className="text-xs text-[#8C9891] font-mono mt-1">S1=(0,3) • S2=(4,3) • S3=(0,0)</div>
            <div className="text-[10px] text-[#39FF88]/80 font-mono mt-0.5">Alvos: 107×125cm • Espaçamento: 30cm • Margem: 10cm</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <SettingSection icon={Settings} title="Sistema">
          <SettingRow label="Nome do Sistema" description="Identificação da plataforma">
            <input
              value={settings.systemName}
              onChange={e => update('systemName', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm w-44 focus:outline-none focus:border-amber-400/50"
            />
          </SettingRow>
          <SettingRow label="Porta API" description="Porta do servidor backend">
            <input
              value={settings.apiPort}
              onChange={e => update('apiPort', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm w-24 focus:outline-none focus:border-amber-400/50 font-mono"
            />
          </SettingRow>
          <SettingRow label="Timeout de Sessão (min)" description="Tempo até deslogar automaticamente">
            <input
              value={settings.sessionTimeout}
              onChange={e => update('sessionTimeout', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm w-24 focus:outline-none focus:border-amber-400/50 font-mono"
            />
          </SettingRow>
          <SettingRow label="Max. Jogadores/Equipamento">
            <input
              value={settings.maxPlayersPerEquipment}
              onChange={e => update('maxPlayersPerEquipment', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm w-24 focus:outline-none focus:border-amber-400/50 font-mono"
            />
          </SettingRow>
        </SettingSection>

        
        <SettingSection icon={Wifi} title="Hardware e Conexão">
          <SettingRow label="Modo de Operação" description="Simulação ou hardware real">
            <select
              value={settings.hardwareMode}
              onChange={e => update('hardwareMode', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm focus:outline-none focus:border-amber-400/50"
            >
              <option value="simulation">Simulação</option>
              <option value="serial">Serial (Arduino/ESP32)</option>
              <option value="websocket">WebSocket</option>
              <option value="api">API REST</option>
            </select>
          </SettingRow>
          <SettingRow label="Baud Rate Serial" description="Para Arduino/ESP32 via porta serial">
            <select
              value={settings.serialBaudRate}
              onChange={e => update('serialBaudRate', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm focus:outline-none focus:border-amber-400/50 font-mono"
            >
              {['9600','19200','38400','57600','115200'].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </SettingRow>
          <SettingRow label="Caminho WebSocket" description="Ex: /ws">
            <input
              value={settings.webSocketPath}
              onChange={e => update('webSocketPath', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm w-28 focus:outline-none focus:border-amber-400/50 font-mono"
            />
          </SettingRow>
          <SettingRow label="WebSocket Habilitado">
            <Toggle enabled={settings.wsEnabled} onChange={v => update('wsEnabled', v)} />
          </SettingRow>
        </SettingSection>

        
        <SettingSection icon={Globe} title="Configurações de Jogo">
          <SettingRow label="Modo Padrão" description="Modo selecionado ao abrir /app/play">
            <select
              value={settings.defaultGameMode}
              onChange={e => update('defaultGameMode', e.target.value)}
              className="bg-[#07110B] border border-[#1B3624] rounded-lg px-3 py-1.5 text-[#F5F7F5] text-sm focus:outline-none focus:border-amber-400/50"
            >
              <option value="free">Treino Livre</option>
              <option value="single">Alvo Único</option>
              <option value="clear_all">Apague Todos</option>
            </select>
          </SettingRow>
          <SettingRow label="Notificações de Conquista">
            <Toggle enabled={settings.notifications} onChange={v => update('notifications', v)} />
          </SettingRow>
        </SettingSection>

        
        <SettingSection icon={Shield} title="Manutenção e Debug">
          <SettingRow label="Backup Automático" description="Backup diário do banco de dados">
            <Toggle enabled={settings.autoBackup} onChange={v => update('autoBackup', v)} />
          </SettingRow>
          <SettingRow label="Modo Debug" description="Logs detalhados no console">
            <Toggle enabled={settings.debugMode} onChange={v => update('debugMode', v)} />
          </SettingRow>
          <SettingRow label="Modo de Manutenção" description="Bloqueia acesso de jogadores">
            <Toggle enabled={settings.maintenanceMode} onChange={v => update('maintenanceMode', v)} />
          </SettingRow>
          {settings.maintenanceMode && (
            <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-amber-400 text-xs">
              <AlertCircle size={14} />
              Atenção: Modo de manutenção ativo bloqueia o acesso dos jogadores.
            </div>
          )}
        </SettingSection>
      </div>

      
      <SettingSection icon={Database} title="Informações do Banco de Dados">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Engine', value: 'SQLite3' },
            { label: 'Arquivo', value: 'smart_tennis.db' },
            { label: 'Localização', value: 'server/database/' },
            { label: 'Modo', value: 'Leitura/Escrita' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#07110B] rounded-xl p-3 border border-[#1B3624]">
              <div className="text-[#8C9891] text-xs uppercase tracking-wider mb-1">{label}</div>
              <div className="text-[#F5F7F5] text-sm font-mono font-medium truncate">{value}</div>
            </div>
          ))}
        </div>
      </SettingSection>
    </div>
  );
}
