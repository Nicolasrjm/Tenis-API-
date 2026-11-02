import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Clock,
  GraduationCap,
  CheckCircle2,
  Sparkles,
  User
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SkillAcademyPage() {
  const { skill } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isInsideAppLayout = location.pathname.startsWith('/app');
  const baseAcademyPath = isInsideAppLayout ? '/app/academy' : '/academy';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getAcademySkillContent(skill)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || 'Não foi possível carregar este módulo.');
      })
      .finally(() => setLoading(false));
  }, [skill]);

  if (loading) {
    return (
      <div className="p-8 text-center text-[#39FF88] font-mono text-sm">
        CARREGANDO MÓDULO TÉCNICO...
      </div>
    );
  }

  if (error || !data || !data.skill) {
    return (
      <div className="p-8 text-center text-[#FF4D4D] font-mono text-sm space-y-4">
        <div>{error || 'Módulo não encontrado.'}</div>
        <Link
          to={baseAcademyPath}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-[#39FF88]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para a Academy</span>
        </Link>
      </div>
    );
  }

  const { skill: attr, lessons = [], plannedSlots = [], relatedTrainings = [] } = data;

  const content = (
    <div className="space-y-8 pb-12">
      {/* Back navigation */}
      <Link
        to={baseAcademyPath}
        className="inline-flex items-center space-x-2 text-xs font-mono text-[#8C9891] hover:text-[#39FF88] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao Catálogo da Academy</span>
      </Link>

      {/* Skill Header Card */}
      <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-[#07110B] border border-[#39FF88]/30 flex items-center justify-center text-3xl shrink-0">
            {attr.icon}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#39FF88]">
                Módulo Técnico • Acesso 100% Gratuito
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#F5F7F5]">{attr.name}</h1>
            <p className="text-xs text-[#8C9891] mt-1 max-w-xl">{attr.description}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-[#07110B] px-4 py-3 rounded-xl border border-[#1B3624] shrink-0">
          <Sparkles className="w-4 h-4 text-[#39FF88]" />
          <span className="text-xs font-mono text-[#39FF88] font-bold">
            {lessons.length} aula(s) publicada(s)
          </span>
        </div>
      </div>

      {/* Videoaulas Publicadas deste Módulo */}
      <div className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-[#F5F7F5]">
          Videoaulas Publicadas ({lessons.length})
        </h2>

        {lessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => navigate(`${baseAcademyPath}/aula/${lesson.id}`)}
                className="cursor-pointer rounded-2xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88] overflow-hidden flex flex-col justify-between group transition-all"
              >
                <div>
                  <div className="h-40 bg-[#07110B] border-b border-[#1B3624] relative flex items-center justify-center overflow-hidden">
                    {lesson.thumbnail ? (
                      <img
                        src={lesson.thumbnail}
                        alt={lesson.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : null}
                    <div className="w-12 h-12 rounded-full bg-[#39FF88] border border-[#39FF88] flex items-center justify-center text-[#07110B] shadow-lg absolute">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded bg-[#39FF88]/20 border border-[#39FF88]/40 text-[10px] font-mono text-[#39FF88] uppercase font-bold">
                      PUBLICADO
                    </span>
                    <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-[#8C9891] flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-[#39FF88]" />
                      <span>{lesson.duration}</span>
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#102216] text-[#39FF88] border border-[#39FF88]/20 uppercase">
                        {lesson.level || lesson.difficulty}
                      </span>
                      {lesson.completed && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-[#39FF88] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluída</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#F5F7F5] mb-2">{lesson.title}</h3>
                    <p className="text-xs text-[#8C9891] leading-relaxed line-clamp-2">
                      {lesson.description}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-[#1B3624]/60 text-xs font-mono">
                  <span className="text-[#8C9891] flex items-center gap-1 truncate">
                    <User className="w-3.5 h-3.5 text-[#39FF88]" />
                    <span>{lesson.instructor || 'Professor da Academy'}</span>
                  </span>
                  <span className="text-[#39FF88] font-bold">Assistir →</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624] text-xs font-mono text-[#8C9891]">
            As videoaulas deste módulo estão em fase de preparação e serão disponibilizadas gratuitamente assim que publicadas pelo administrador.
          </div>
        )}
      </div>

      {/* Slots Planejados do Módulo */}
      {plannedSlots.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#8C9891]">
            Cronograma Planejado do Módulo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plannedSlots.map((slot) => (
              <div
                key={slot.slot_number}
                className="p-4 rounded-xl bg-[#0C1A11] border border-[#1B3624] flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono text-[#39FF88] block uppercase">
                    Aula {String(slot.slot_number).padStart(2, '0')} • Nível {slot.level}
                  </span>
                  <span className="text-xs font-bold text-[#F5F7F5]">{slot.title}</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#07110B] border border-[#1B3624] text-[10px] font-mono uppercase text-[#8C9891]">
                  {slot.published ? 'Publicado' : 'Em breve'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Treinos Práticos Relacionados */}
      {relatedTrainings && relatedTrainings.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#F5F7F5]">
            Treinos Práticos Relacionados na Parede Interativa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedTrainings.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl bg-[#0C1A11] border border-[#1B3624] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#F5F7F5]">{t.title}</span>
                    <span className="text-[10px] font-mono text-[#39FF88]">+{t.xp_reward} XP</span>
                  </div>
                  <p className="text-xs text-[#8C9891] mt-1">{t.description}</p>
                </div>
                <Link
                  to="/app/play"
                  className="px-3 py-1.5 rounded-lg bg-[#39FF88]/10 hover:bg-[#39FF88]/20 text-[#39FF88] border border-[#39FF88]/30 text-xs font-mono transition-colors shrink-0 ml-4"
                >
                  Praticar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (!isInsideAppLayout) {
    return (
      <div className="min-h-screen bg-[#07110B] text-[#F5F7F5] flex flex-col">
        <header className="sticky top-0 z-40 h-16 bg-[#0C1A11]/95 backdrop-blur-md border-b border-[#1B3624] px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/academy"
              className="inline-flex items-center space-x-2 text-xs font-mono text-[#8C9891] hover:text-[#39FF88] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Catálogo Academy</span>
            </Link>
            <div className="h-5 w-px bg-[#1B3624]" />
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-5 h-5 text-[#39FF88]" />
              <span className="font-black tracking-wider text-sm uppercase">
                MOTION TENNIS <span className="text-[#39FF88]">ACADEMY</span>
              </span>
            </div>
          </div>

          <Link
            to={user ? '/app/dashboard' : '/login'}
            className="px-3.5 py-2 rounded-xl bg-[#39FF88] text-[#07110B] font-bold text-xs uppercase tracking-wider"
          >
            {user ? 'Meu Painel' : 'Entrar / Jogar'}
          </Link>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {content}
        </main>
      </div>
    );
  }

  return content;
}
