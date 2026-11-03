import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Link2,
  Unlink,
  Lock,
  Mail,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  getCloudConfig,
  getCloudStatus,
  linkOnlineAccount,
  unlinkOnlineAccount
} from '../services/cloudAuthService';

export default function CloudLinkCard({ onStatusChange }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Feedback messages
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    loadCloudData();
  }, []);

  const loadCloudData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [cfg, stat] = await Promise.all([
        getCloudConfig().catch(() => ({ configured: false })),
        getCloudStatus().catch(() => ({ linked: false }))
      ]);
      setConfig(cfg);
      setStatus(stat);
      if (onStatusChange) onStatusChange(stat);
    } catch (err) {
      setErrorMsg('Não foi possível verificar o status da nuvem com o servidor local.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Informe o e-mail e a senha da sua conta online.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await linkOnlineAccount({ email, password });
      setSuccessMsg(result.message || 'Conta online vinculada com sucesso!');
      // Limpa a senha imediatamente da memória de estado
      setPassword('');
      setShowForm(false);
      // Atualiza o status
      await loadCloudData();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao vincular a conta online.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await unlinkOnlineAccount();
      setSuccessMsg(res?.message || 'Conta online desvinculada com sucesso.');
      setShowUnlinkConfirm(false);
      await loadCloudData();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao desvincular a conta.');
    } finally {
      setUnlinking(false);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const isLinked = Boolean(status?.linked && status?.identity);

  return (
    <div
      data-testid="cloud-link-card"
      className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-5 transition-all shadow-xl"
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${
              isLinked
                ? 'bg-[#102216] border-[#39FF88]/40 text-[#39FF88] shadow-neon-sm'
                : 'bg-[#141F17] border-amber-500/30 text-amber-400'
            }`}
          >
            {isLinked ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#F5F7F5] tracking-wide">
                Conta Online & Sincronização Cloud
              </h3>
            </div>
            <p className="text-xs text-[#8C9891] mt-0.5">
              Associação de identidade com o Supabase Auth para envio automático de partidas.
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={loadCloudData}
          disabled={loading || submitting}
          data-testid="btn-refresh-cloud-status"
          className="p-2 rounded-xl bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88]/40 text-[#8C9891] hover:text-[#39FF88] transition-colors disabled:opacity-50"
          title="Atualizar status da conexão online"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#39FF88]' : ''}`} />
        </button>
      </div>

      {/* Status Badge & Summary */}
      <div className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <span
            data-testid="cloud-link-status-badge"
            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
              isLinked
                ? 'bg-[#102216] text-[#39FF88] border-[#39FF88]/40'
                : config?.configured
                ? 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700'
            }`}
          >
            {isLinked ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#39FF88]" />
                <span>CONTA ONLINE VINCULADA</span>
              </>
            ) : config?.configured ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>OFFLINE (SEM VÍNCULO ONLINE)</span>
              </>
            ) : (
              <span>NUVEM DESATIVADA NO SERVIDOR</span>
            )}
          </span>
        </div>

        <div className="text-[11px] font-mono text-[#8C9891]">
          {isLinked && status?.identity?.linkedAt && (
            <span>Vinculado em: {formatDate(status.identity.linkedAt)}</span>
          )}
          {!isLinked && config?.configured && (
            <span>Partidas salvas localmente aguardam vinculação</span>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div
          data-testid="cloud-link-error-msg"
          className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start space-x-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          data-testid="cloud-link-success-msg"
          className="p-3.5 rounded-xl bg-[#102216] border border-[#39FF88]/50 text-[#39FF88] text-xs font-mono flex items-start space-x-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-[#39FF88] shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Linked Identity Card */}
      {isLinked && (
        <div className="p-4 rounded-2xl bg-[#0D1F14] border border-[#39FF88]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#39FF88] font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Identidade Cloud Autenticada
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#07110B] border border-[#1B3624]">
              <span className="text-[10px] font-mono text-[#8C9891] block">E-MAIL VINCULADO</span>
              <span className="font-bold text-[#F5F7F5] truncate block">
                {status.identity.email || '(sem e-mail no token)'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#07110B] border border-[#1B3624]">
              <span className="text-[10px] font-mono text-[#8C9891] block">UUID SUPABASE AUTH</span>
              <span className="font-mono text-[11px] text-[#39FF88] truncate block" title={status.identity.cloudUserId}>
                {status.identity.cloudUserId}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#8C9891] leading-relaxed">
            Suas partidas finalizadas neste equipamento agora são enfileiradas e sincronizadas
            automaticamente com o banco de dados do Supabase.
          </p>

          {/* Unlink Action */}
          <div className="pt-2 border-t border-[#1B3624]/60 flex items-center justify-between">
            {!showUnlinkConfirm ? (
              <button
                type="button"
                onClick={() => setShowUnlinkConfirm(true)}
                data-testid="btn-unlink-cloud"
                className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors py-1 px-2 rounded-lg hover:bg-rose-950/30"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Desvincular conta online</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full justify-between">
                <span className="text-xs text-rose-300 font-mono">Confirmar desvinculação?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUnlink}
                    disabled={unlinking}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-mono transition-colors disabled:opacity-50"
                  >
                    {unlinking ? 'Desvinculando...' : 'Sim, desvincular'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUnlinkConfirm(false)}
                    className="px-3 py-1 rounded-lg bg-[#07110B] border border-[#1B3624] text-xs font-mono text-[#8C9891] hover:text-[#F5F7F5]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not Linked Form / CTA */}
      {!isLinked && config?.configured && (
        <div className="space-y-4">
          {!showForm ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <p className="text-xs text-[#8C9891]">
                Conecte seu atleta a uma conta Supabase Auth existente para liberar a sincronização online.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                data-testid="btn-open-cloud-link"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl btn-neon font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center space-x-2 shadow-neon transition-all shrink-0"
              >
                <Link2 className="w-4 h-4" />
                <span>Vincular Conta Online</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleLinkSubmit} className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#1B3624] pb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-[#39FF88] font-bold flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Autenticar Conta Online
                </span>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs font-mono text-[#8C9891] hover:text-[#F5F7F5]"
                >
                  Fechar
                </button>
              </div>

              <p className="text-[11px] text-[#8C9891]">
                Informe o e-mail e a senha cadastrados no Supabase Auth. Suas credenciais são enviadas diretamente ao servidor de autenticação seguro.
              </p>

              <div>
                <label className="block text-[11px] font-mono text-[#8C9891] mb-1.5 uppercase">
                  E-mail da Conta Online
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex: nicolas@exemplo.com"
                    data-testid="input-cloud-email"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-[#F5F7F5] text-xs font-mono focus:border-[#39FF88] focus:outline-none transition-colors"
                  />
                  <Mail className="w-3.5 h-3.5 text-[#8C9891] absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8C9891] mb-1.5 uppercase">
                  Senha da Conta Online
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    data-testid="input-cloud-password"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-[#F5F7F5] text-xs font-mono focus:border-[#39FF88] focus:outline-none transition-colors"
                  />
                  <Lock className="w-3.5 h-3.5 text-[#8C9891] absolute left-3 top-3" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="btn-submit-cloud-link"
                  className="flex-1 py-3 rounded-xl btn-neon font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center space-x-2 shadow-neon transition-all disabled:opacity-50"
                >
                  <Link2 className="w-4 h-4" />
                  <span>{submitting ? 'AUTENTICANDO & VINCULANDO...' : 'VINCULAR MINHA CONTA ONLINE'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="px-4 py-3 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-xs font-mono text-[#8C9891] hover:text-[#F5F7F5] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
