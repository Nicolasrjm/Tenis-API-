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
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#08120B] border border-[#295437]">
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5]">Visão Geral da Operação</h1>
          <p className="text-xs text-[#8C9891] mt-0.5">
            Monitoramento de unidades Motion Tennis em tempo real e base de atletas.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/admin/equipments"
            className="px-4 py-2 rounded-xl bg-amber-400 text-[#07110B] font-bold text-xs uppercase flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Equipamento</span>
          </Link>
          <Link
            to="/admin/users"
            className="px-4 py-2 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-[#39FF88] font-bold text-xs uppercase flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Usuário</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        <div className="p-5 rounded-2xl bg-[#08120B] border border-[#295437]">
          <div className="flex items-center justify-between text-xs text-[#8C9891] mb-2">
            <span>ATLETAS ATIVOS</span>
            <Users className="w-4 h-4 text-[#39FF88]" />
          </div>
          <div className="text-3xl font-black text-[#F5F7F5]">{reports?.totalPlayers || 0}</div>
          <div className="text-[10px] text-[#8C9891] mt-1">Jogadores cadastrados</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#08120B] border border-[#295437]">
          <div className="flex items-center justify-between text-xs text-[#8C9891] mb-2">
            <span>EQUIPAMENTOS</span>
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{reports?.totalEquipments || 0}</div>
          <div className="text-[10px] text-[#8C9891] mt-1">Unidades físicas</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#08120B] border border-[#295437]">
          <div className="flex items-center justify-between text-xs text-[#8C9891] mb-2">
            <span>SESSÕES TOTAIS</span>
            <Activity className="w-4 h-4 text-[#39FF88]" />
          </div>
          <div className="text-3xl font-black text-[#F5F7F5]">{reports?.totalSessions || 0}</div>
          <div className="text-[10px] text-[#8C9891] mt-1">Treinos computados</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#08120B] border border-[#295437]">
          <div className="flex items-center justify-between text-xs text-[#8C9891] mb-2">
            <span>PRECISÃO MÉDIA</span>
            <Target className="w-4 h-4 text-[#39FF88]" />
          </div>
          <div className="text-3xl font-black text-[#39FF88]">{reports?.averageAccuracy || 82}%</div>
          <div className="text-[10px] text-[#8C9891] mt-1">Média dos jogadores</div>
        </div>
      </div>

      {/* Unidades Físicas Motion Tennis (Requirement 7) */}
      <div className="p-6 rounded-3xl bg-[#08120B] border border-[#295437] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-[#F5F7F5]">Unidades Físicas Motion Tennis Cadastradas</h2>
          </div>
          <Link to="/admin/equipments" className="text-xs text-amber-400 hover:underline font-mono">
            Gerenciar Todos →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {equipments.map((eq) => (
            <div
              key={eq.id}
              className="p-5 rounded-2xl bg-[#060D08] border border-[#1B3624] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-[#F5F7F5]">{eq.name}</h3>
                  <span className="text-[11px] font-mono text-[#8C9891]">{eq.code} • {eq.location}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  eq.status === 'online' ? 'bg-[#39FF88]/20 text-[#39FF88]' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  ● {eq.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1B3624] font-mono text-center text-xs">
                <div>
                  <span className="text-[10px] text-[#8C9891]">JOGADORES</span>
                  <div className="font-bold text-[#F5F7F5]">{eq.users_count || 0}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[#8C9891]">SESSÕES</span>
                  <div className="font-bold text-[#F5F7F5]">{eq.sessions_count || 0}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[#8C9891]">SENSORES</span>
                  <div className="font-bold text-[#39FF88]">11 FIXOS</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
