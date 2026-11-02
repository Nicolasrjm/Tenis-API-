import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  Settings2, 
  CheckCircle2, 
  Clock, 
  X,
  Server
} from 'lucide-react';
import { syncService, SyncState } from '../services/syncService';
import { 
  getSavedServerUrl, 
  saveServerUrl, 
  testServerConnection,
  isNativeMobile 
} from '../services/serverConfig';
import { api } from '../services/api';

export default function SyncStatusBar() {
  const [syncInfo, setSyncInfo] = useState({
    state: syncService.currentState,
    lastSyncAt: syncService.lastSyncAt,
    errorMessage: syncService.lastErrorMessage,
    userId: syncService.currentUserId
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getSavedServerUrl() || '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((updated) => {
      setSyncInfo(updated);
    });
    return () => unsubscribe();
  }, []);

  const handleSyncNow = async () => {
    setIsSyncingManual(true);
    try {
      await syncService.syncNow(api);
    } catch (e) {
      // Já tratado no serviço
    } finally {
      setIsSyncingManual(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testServerConnection(serverUrlInput);
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerConfig = async (e) => {
    e.preventDefault();
    saveServerUrl(serverUrlInput);
    setIsModalOpen(false);
    // Tenta sincronizar com o novo IP configurado
    handleSyncNow();
  };

  const formatLastSync = (isoString) => {
    if (!isoString) return 'Nunca sincronizado';
    try {
      const date = new Date(isoString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${mins}`;
    } catch {
      return isoString;
    }
  };

  const renderStatusBadge = () => {
    switch (syncInfo.state) {
      case SyncState.SYNCING:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Sincronizando...</span>
          </span>
        );
      case SyncState.OFFLINE:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Modo Offline</span>
          </span>
        );
      case SyncState.ERROR:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Desconectado</span>
          </span>
        );
      case SyncState.ONLINE:
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Wifi className="w-3.5 h-3.5" />
            <span>Online</span>
          </span>
        );
    }
  };

  return (
    <>
      <div className="w-full bg-[#08130B]/90 backdrop-blur border-b border-[#1B3624] px-4 py-2 text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Lado Esquerdo: Status e Última Sincronização */}
          <div className="flex items-center space-x-3">
            {renderStatusBadge()}
            <div className="flex items-center space-x-1 text-[#8C9891]">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Última sincronização:{' '}
                <strong className="text-[#F5F7F5] font-semibold">
                  {formatLastSync(syncInfo.lastSyncAt)}
                </strong>
              </span>
            </div>
          </div>

          {/* Lado Direito: Ações */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSyncNow}
              disabled={syncInfo.state === SyncState.SYNCING || isSyncingManual}
              className="px-3 py-1.5 rounded-lg bg-[#102216] border border-[#39FF88]/40 hover:border-[#39FF88] text-[#39FF88] hover:bg-[#39FF88]/10 text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50"
              title="Sincronizar estatísticas com o servidor do notebook"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncInfo.state === SyncState.SYNCING || isSyncingManual ? 'animate-spin' : ''}`} />
              <span>Sincronizar agora</span>
            </button>

            <button
              onClick={() => {
                setServerUrlInput(getSavedServerUrl() || '');
                setTestResult(null);
                setIsModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-[#102216] border border-[#1B3624] hover:border-[#39FF88]/50 text-[#8C9891] hover:text-[#39FF88] transition-colors"
              title="Configurar endereço do notebook"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Configuração do Servidor / Notebook */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] p-6 shadow-2xl relative space-y-6">
            
            <div className="flex items-center justify-between border-b border-[#1B3624] pb-4">
              <div className="flex items-center space-x-2 text-[#39FF88]">
                <Server className="w-5 h-5" />
                <h3 className="text-base font-black uppercase text-[#F5F7F5] tracking-tight">
                  Conexão com Notebook
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C9891] hover:text-[#F5F7F5] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveServerConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase text-[#8C9891] block">
                  Endereço IP do Notebook na Rede Local
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder="http://192.168.1.100:3000"
                    className="w-full bg-[#07110B] border border-[#1B3624] focus:border-[#39FF88] rounded-xl px-4 py-3 text-sm text-[#F5F7F5] font-mono outline-none"
                  />
                </div>
                <p className="text-[11px] text-[#8C9891] leading-relaxed">
                  Informe o IP do notebook na mesma rede Wi-Fi ou Hotspot móvel do Windows (porta padrão 3000).
                </p>
              </div>

              {/* Resultado do Teste */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs font-mono space-y-1 ${
                  testResult.success
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-400'
                }`}>
                  <div className="flex items-center space-x-1.5 font-bold">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{testResult.success ? 'Conexão Estabelecida!' : 'Falha na Conexão'}</span>
                  </div>
                  {testResult.success && (
                    <p className="text-[11px] text-emerald-300/80">
                      Latência: {testResult.latency}ms — Motion Tennis Online
                    </p>
                  )}
                  {!testResult.success && (
                    <p className="text-[11px] text-rose-300/80">
                      {testResult.error}
                    </p>
                  )}
                </div>
              )}

              {/* Botões do Modal */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#102216] border border-[#1B3624] hover:border-[#39FF88]/50 text-[#F5F7F5] text-xs font-bold font-mono uppercase transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testando...' : 'Testar Conexão'}</span>
                </button>

                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl btn-neon text-xs font-bold font-mono uppercase transition-all shadow-neon flex items-center justify-center space-x-1.5"
                >
                  <span>Salvar e Conectar</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
}
