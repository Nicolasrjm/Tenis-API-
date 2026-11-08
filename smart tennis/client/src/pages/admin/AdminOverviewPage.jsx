import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Cpu, 
  Activity, 
  Target, 
  Plus, 
  ArrowRight, 
  Radio, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../../services/api';

export default function AdminOverviewPage() {
  const [reports, setReports] = useState(null);
  const [equipments, setEquipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rep, eq] = await Promise.all([
        api.admin.getReports(),
        api.admin.getEquipments()
      ]);
      setReports(rep);
      setEquipments(eq || []);
    } catch (e) {
      console.error('Erro ao carregar visão geral do admin:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#142B3D] dark:text-[#F1F5F9]">Visão Geral da Operação</h1>
          <p className="text-xs text-[#475569] dark:text-[#A8BAC8] mt-0.5">
            Monitoramento de unidades Motion Tennis em tempo real e base de atletas.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/admin/equipments"
            className="px-4 py-2 rounded-xl bg-amber-400 text-[#07110B] font-bold text-xs uppercase flex items-center space-x-1.5 shadow-sm hover:brightness-105 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Equipamento</span>
          </Link>
          <Link
            to="/admin/users"
            className="px-4 py-2 rounded-xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653] text-[#142B3D] dark:text-[#F1F5F9] font-bold text-xs uppercase flex items-center space-x-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Usuário</span>
          </Link>
        </div>
      </div>

      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        <div className="p-5 rounded-2xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A8BAC8] mb-2">
            <span>ATLETAS ATIVOS</span>
            <Users className="w-4 h-4 text-emerald-500 dark:text-[#B8F044]" />
          </div>
          <div className="text-3xl font-black text-[#142B3D] dark:text-[#F1F5F9]">{reports?.totalPlayers || 0}</div>
          <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-1">Jogadores cadastrados</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A8BAC8] mb-2">
            <span>EQUIPAMENTOS</span>
            <Cpu className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-500 dark:text-amber-400">{reports?.totalEquipments || 0}</div>
          <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-1">Unidades físicas</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A8BAC8] mb-2">
            <span>SESSÕES TOTAIS</span>
            <Activity className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="text-3xl font-black text-[#142B3D] dark:text-[#F1F5F9]">{reports?.totalSessions || 0}</div>
          <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-1">Treinos computados</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A8BAC8] mb-2">
            <span>PRECISÃO MÉDIA</span>
            <Target className="w-4 h-4 text-emerald-500 dark:text-[#B8F044]" />
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-[#B8F044]">{reports?.averageAccuracy || 82}%</div>
          <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-1">Média dos jogadores</div>
        </div>
      </div>

      
      <div className="p-6 rounded-3xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h2 className="text-base font-bold text-[#142B3D] dark:text-[#F1F5F9]">Unidades Físicas Motion Tennis Cadastradas</h2>
          </div>
          <Link to="/admin/equipments" className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-mono">
            Gerenciar Todos →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {equipments.map((eq) => (
            <div
              key={eq.id}
              className="p-5 rounded-2xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-[#142B3D] dark:text-[#F1F5F9]">{eq.name}</h3>
                  <span className="text-[11px] font-mono text-[#475569] dark:text-[#A8BAC8]">{eq.code} • {eq.location}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  eq.status === 'online' ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#B8F044]' : 'bg-rose-500/20 text-rose-500 dark:text-rose-400'
                }`}>
                  ● {eq.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#B8C6D0] dark:border-[#344653] font-mono text-center text-xs">
                <div>
                  <span className="text-[10px] text-[#475569] dark:text-[#A8BAC8]">JOGADORES</span>
                  <div className="font-bold text-[#142B3D] dark:text-[#F1F5F9]">{eq.users_count || 0}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[#475569] dark:text-[#A8BAC8]">SESSÕES</span>
                  <div className="font-bold text-[#142B3D] dark:text-[#F1F5F9]">{eq.sessions_count || 0}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[#475569] dark:text-[#A8BAC8]">SENSORES</span>
                  <div className="font-bold text-emerald-600 dark:text-[#B8F044]">3 KY-037</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
