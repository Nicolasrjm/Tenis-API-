import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitFork, 
  Target, 
  Activity, 
  Zap, 
  Shield, 
  Compass, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { api } from '../services/api';

export default function EvolutionPage({ onSelectSkill, onLevelUp }) {
  const navigate = useNavigate();
  const [attributes, setAttributes] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvolutionData();
  }, []);

  const loadEvolutionData = async () => {
    try {
      const [attrs, tree] = await Promise.all([
        api.getAttributes(),
        api.getSkillTree()
      ]);
      setAttributes(attrs || []);
      setNodes(tree || []);
      if (tree && tree.length > 0 && !selectedNode) {
        setSelectedNode(tree[0]);
      }
    } catch (e) {
      console.error('Erro ao carregar dados de evolução:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockNode = async (nodeId) => {
    try {
      const res = await api.unlockSkillNode(nodeId);
      await loadEvolutionData();
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => ({ ...prev, status: 'completed' }));
      }
    } catch (e) {
      console.error('Erro ao desbloquear habilidade:', e);
    }
  };

  const attributeIcons = {
    precision: Target,
    consistency: Activity,
    speed: Zap,
    control: Shield,
    reflex: Sparkles,
    strategy: Compass
  };

  return (
    <div className="space-y-10 animate-fadeIn max-w-6xl mx-auto">
      
      {/* Page Header */}
      <div className="p-6 rounded-3xl bg-[#0C1A11] border border-[#1B3624] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#F5F7F5] flex items-center space-x-2">
            <GitFork className="w-6 h-6 text-[#39FF88]" />
            <span>Minha Evolução & Árvore de Habilidades</span>
          </h1>
          <p className="text-xs text-[#8C9891] mt-1">
            Sistema RPG de progressão de atleta. Desbloqueie técnicas, cumpra requisitos e evolua seus atributos.
          </p>
        </div>
      </div>

      {/* 1. SEÇÃO DE ATRIBUTOS DO JOGADOR (Requirement 14) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#F5F7F5]">Atributos Principais do Jogador</h2>
          <span className="text-xs text-[#8C9891]">Clique em um atributo para ver dicas técnicas e treinos</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {attributes.map((attr) => {
            const Icon = attributeIcons[attr.key] || Target;
            const pct = Math.min(100, Math.round((attr.xp / attr.xp_next) * 100));

            return (
              <div
                key={attr.key}
                onClick={() => {
                  if (onSelectSkill) onSelectSkill(attr.key);
                  else navigate(`/app/academy/${attr.key}`);
                }}
                className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/60 cursor-pointer transition-all hover:-translate-y-0.5 group shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88] group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors">
                        {attr.name}
                      </h3>
                      <span className="text-[11px] font-mono font-bold text-[#39FF88]">
                        LV. {attr.level} / {attr.max_level}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8C9891] group-hover:text-[#39FF88] group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-[#8C9891]">
                    <span>EXP</span>
                    <span>{attr.xp} / {attr.xp_next} XP</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#07110B] border border-[#1B3624] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#16C96B] to-[#39FF88] rounded-full transition-all duration-500 shadow-neon-sm"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* 2. ÁRVORE VISUAL DE EVOLUÇÃO (SKILL TREE) (Requirement 15) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#F5F7F5] flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-[#39FF88]" />
              <span>Árvore de Maestria Esportiva</span>
            </h2>
            <p className="text-xs text-[#8C9891]">
              Trajetória visual de aprendizado do atleta: Iniciante → Intermediário → Competidor → Especialista.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center space-x-3 text-[10px] font-mono">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#39FF88]"></span>
              <span>Concluído</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Disponível</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#8C9891]"></span>
              <span>Bloqueado</span>
            </span>
          </div>
        </div>

        {/* Visual Skill Tree Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
          
          {/* Interactive Tree Graph */}
          <div className="lg:col-span-7 bg-[#07110B] border border-[#1B3624] rounded-2xl p-6 relative overflow-hidden min-h-[460px] flex flex-col justify-between">
            <div className="absolute inset-0 bg-tech-grid opacity-15 pointer-events-none"></div>

            {/* Nodes Stack */}
            <div className="relative z-10 space-y-4">
              {nodes.map((node, i) => {
                const isSelected = selectedNode?.id === node.id;
                const isCompleted = node.status === 'completed';
                const isUnlocked = node.status === 'unlocked' || node.status === 'available';

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-[#39FF88] bg-[#102216] shadow-neon'
                        : isCompleted
                        ? 'border-[#39FF88]/40 bg-[#0C1A11]/80 hover:border-[#39FF88]'
                        : isUnlocked
                        ? 'border-amber-400/40 bg-[#0C1A11] hover:border-amber-400'
                        : 'border-[#1B3624]/60 bg-[#07110B]/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
                        isCompleted
                          ? 'bg-[#39FF88] text-[#07110B]'
                          : isUnlocked
                          ? 'bg-amber-400 text-[#07110B]'
                          : 'bg-[#122419] text-[#8C9891]'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-[#F5F7F5]">{node.title}</h4>
                          <span className="text-[10px] font-mono text-[#8C9891]">Tier {node.tier}</span>
                        </div>
                        <p className="text-[11px] text-[#8C9891] truncate max-w-xs">{node.description}</p>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-[#39FF88]">+{node.xp_reward} XP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Node Details Card */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-[#09150E] border border-[#1B3624] space-y-4">
            {selectedNode ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#39FF88] uppercase tracking-wider font-bold">
                    DETALHES DO NÓ
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    selectedNode.status === 'completed'
                      ? 'bg-[#39FF88]/20 text-[#39FF88]'
                      : selectedNode.status === 'unlocked' || selectedNode.status === 'available'
                      ? 'bg-amber-400/20 text-amber-400'
                      : 'bg-[#122419] text-[#8C9891]'
                  }`}>
                    {selectedNode.status === 'completed' ? 'CONCLUÍDO' : selectedNode.status === 'locked' ? 'BLOQUEADO' : 'DISPONÍVEL'}
                  </span>
                </div>

                <h3 className="text-xl font-black text-[#F5F7F5]">
                  {selectedNode.title}
                </h3>

                <p className="text-xs text-[#8C9891] leading-relaxed">
                  {selectedNode.description}
                </p>

                {/* Requirement Box (Requirement 15) */}
                <div className="p-3.5 rounded-xl bg-[#0C1A11] border border-[#1B3624] space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-[#F5F7F5]">
                    <Info className="w-3.5 h-3.5 text-[#39FF88]" />
                    <span>Requisito para Desbloqueio:</span>
                  </div>
                  <p className="text-xs text-[#8C9891] font-mono pl-5">
                    {selectedNode.requirement || 'Nenhum pré-requisito adicional.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#102216] border border-[#39FF88]/30 flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8C9891]">RECOMPENSA DE EVOLUÇÃO:</span>
                  <span className="text-[#39FF88] font-bold">+{selectedNode.xp_reward} XP</span>
                </div>

                {/* Action button */}
                {selectedNode.status !== 'completed' && (
                  <button
                    onClick={() => handleUnlockNode(selectedNode.id)}
                    className="w-full py-3 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase shadow-neon"
                  >
                    CONCLUIR REQUISITO & EVOLUIR
                  </button>
                )}
                {selectedNode.status === 'completed' && (
                  <div className="py-2.5 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-center text-xs font-bold font-mono text-[#39FF88]">
                    ✓ HABILIDADE DOMINADA
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-xs text-[#8C9891] font-mono">
                Selecione um nó da árvore ao lado.
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
