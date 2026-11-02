import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Clock,
  CheckCircle2,
  Circle,
  User,
  Sparkles,
  BookOpen,
  ShieldAlert,
  GraduationCap,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function isSafeYouTubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[a-zA-Z0-9_-]{11}(\?.*)?$/.test(url.trim());
}

export default function AcademyLessonPage() {
  const { id } = useParams();
  const { user, isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isInsideAppLayout = location.pathname.startsWith('/app');
  const baseAcademyPath = isInsideAppLayout ? '/app/academy' : '/academy';

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState(false);

  const loadLesson = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAcademyLessonDetail(id);
      setDetail(res);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar esta aula.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  const handleToggleCompleted = async () => {
    if (!user || isGuest || !detail?.lesson) return;
    setToggling(true);
    try {
      const nextCompleted = !detail.lesson.completed;
      await api.setAcademyLessonProgress(detail.lesson.id, nextCompleted);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              lesson: { ...prev.lesson, completed: nextCompleted }
            }
          : prev
      );
    } catch (err) {
      alert(err.message || 'Erro ao salvar progresso da aula.');
    } finally {
      setToggling(false);
    }
  };

  const lesson = detail?.lesson || null;
  const relatedLessons = detail?.relatedLessons || [];
  const safeEmbedUrl = lesson?.embed_url && isSafeYouTubeEmbedUrl(lesson.embed_url)
    ? `${lesson.embed_url}${lesson.embed_url.includes('?') ? '&' : '?'}rel=0&modestbranding=1`
    : null;

  const pageBody = (
    <div className="space-y-6 pb-12" data-testid="academy-lesson-playback-page">
      {/* Barra Superior de Retorno ao Catálogo */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={baseAcademyPath}
          data-testid="btn-back-to-catalog"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0C1A11] border border-[#1B3624] text-xs font-mono text-[#F5F7F5] hover:border-[#39FF88] hover:text-[#39FF88] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Catálogo da Academy</span>
        </Link>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#39FF88]/15 border border-[#39FF88]/40 text-[#39FF88] text-[11px] font-mono uppercase font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Acesso Gratuito • Motion Tennis Academy</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 rounded-3xl bg-[#0C1A11] border border-[#1B3624] text-center font-mono text-sm text-[#39FF88]">
          CARREGANDO VIDEOAULA...
        </div>
      ) : error || !lesson ? (
        <div
          data-testid="academy-lesson-error"
          className="p-8 rounded-3xl bg-[#0C1A11] border border-rose-500/40 text-center space-y-4"
        >
          <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-[#F5F7F5]">Aula Indisponível</h2>
          <p className="text-xs text-[#8C9891] max-w-md mx-auto">
            {error || 'Esta aula não foi encontrada ou ainda não foi publicada.'}
          </p>
          <Link
            to={baseAcademyPath}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#39FF88] text-[#07110B] font-bold text-xs uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retornar ao Catálogo</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal: Player YouTube + Detalhes da Aula */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player de Vídeo Integrado (Embed Seguro do YouTube) */}
            <div className="rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] overflow-hidden shadow-2xl">
              {safeEmbedUrl ? (
                <div className="relative aspect-video w-full bg-black">
                  <iframe
                    data-testid="academy-youtube-iframe"
                    src={safeEmbedUrl}
                    title={lesson.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-[#07110B] flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <BookOpen className="w-10 h-10 text-[#8C9891]" />
                  <p className="text-sm font-bold text-[#F5F7F5]">
                    Vídeo ainda não disponível para reprodução
                  </p>
                  <p className="text-xs text-[#8C9891]">
                    Esta aula ainda aguarda vinculação de link válido do YouTube pelo administrador.
                  </p>
                </div>
              )}

              {/* Cabeçalho e Informações da Aula */}
              <div className="p-6 sm:p-8 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      data-testid="lesson-detail-category"
                      className="px-3 py-1 rounded-lg bg-[#39FF88]/15 border border-[#39FF88]/30 text-xs font-mono uppercase font-bold text-[#39FF88]"
                    >
                      {lesson.category}
                    </span>
                    <span
                      data-testid="lesson-detail-level"
                      className="px-3 py-1 rounded-lg bg-[#07110B] border border-[#1B3624] text-xs font-mono uppercase text-[#F5F7F5]"
                    >
                      Nível: {lesson.level}
                    </span>
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[#07110B] border border-[#1B3624] text-xs font-mono text-[#8C9891]">
                      <Clock className="w-3.5 h-3.5 text-[#39FF88]" />
                      <span data-testid="lesson-detail-duration">{lesson.duration}</span>
                    </span>
                  </div>

                  {/* Botão de Marcar/Desmarcar como Concluída (Apenas Usuário Autenticado) */}
                  {user && !isGuest ? (
                    <button
                      type="button"
                      data-testid="btn-lesson-detail-complete"
                      disabled={toggling}
                      onClick={handleToggleCompleted}
                      className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase transition-all ${
                        lesson.completed
                          ? 'bg-[#39FF88] text-[#07110B] shadow-[0_0_20px_rgba(57,255,136,0.35)]'
                          : 'bg-[#07110B] border border-[#39FF88]/50 text-[#39FF88] hover:bg-[#39FF88]/15'
                      }`}
                    >
                      {lesson.completed ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aula Concluída ✓</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4" />
                          <span>Marcar como Concluída</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span
                      data-testid="visitor-free-playback-badge"
                      className="px-3 py-1.5 rounded-xl bg-[#07110B] border border-[#1B3624] text-[11px] font-mono text-[#8C9891]"
                    >
                      Modo Visitante • Reprodução Gratuita
                    </span>
                  )}
                </div>

                <div>
                  <h1
                    data-testid="lesson-detail-title"
                    className="text-xl sm:text-2xl font-black text-[#F5F7F5] leading-snug"
                  >
                    {lesson.title}
                  </h1>
                </div>

                {/* Informações do Professor & Link Oficial */}
                <div className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#102216] border border-[#39FF88]/30 flex items-center justify-center text-[#39FF88]">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#8C9891] block">
                        Instrutor / Professor Responsável
                      </span>
                      <span className="text-sm font-bold text-[#F5F7F5]" data-testid="lesson-detail-instructor">
                        {lesson.instructor ? lesson.instructor : 'A definir pelo professor'}
                      </span>
                    </div>
                  </div>

                  {lesson.youtube_url && (
                    <a
                      href={lesson.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 text-xs font-mono text-[#39FF88] hover:underline"
                    >
                      <span>Abrir também no YouTube</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Descrição Técnica Completa */}
                <div className="space-y-2 pt-2 border-t border-[#1B3624]">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#39FF88] font-bold">
                    Descrição da Aula & Objetivos Técnicos
                  </h3>
                  <p
                    data-testid="lesson-detail-description"
                    className="text-sm text-[#8C9891] leading-relaxed whitespace-pre-line"
                  >
                    {lesson.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Lateral: Aulas Relacionadas */}
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-[#0C1A11] border border-[#1B3624] space-y-4">
              <div className="flex items-center justify-between border-b border-[#1B3624] pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#39FF88] block">
                    Continue Estudando
                  </span>
                  <h2 className="text-base font-bold text-[#F5F7F5]">
                    Aulas Relacionadas
                  </h2>
                </div>
                <Play className="w-4 h-4 text-[#39FF88]" />
              </div>

              {relatedLessons.length > 0 ? (
                <div className="space-y-3" data-testid="related-lessons-list">
                  {relatedLessons.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => navigate(`${baseAcademyPath}/aula/${rel.id}`)}
                      className="p-3 rounded-2xl bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88] cursor-pointer transition-all group flex items-start space-x-3"
                    >
                      <div className="w-20 aspect-video rounded-lg bg-[#0C1A11] overflow-hidden shrink-0 relative border border-[#1B3624]">
                        {rel.thumbnail ? (
                          <img
                            src={rel.thumbnail}
                            alt={rel.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-4 h-4 text-[#39FF88]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-mono text-[#39FF88] uppercase block truncate">
                          {rel.category}
                        </span>
                        <h4 className="text-xs font-bold text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors line-clamp-2">
                          {rel.title}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1 text-[10px] font-mono text-[#8C9891]">
                          <span>{rel.duration}</span>
                          <span>•</span>
                          <span>{rel.level}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#07110B] border border-[#1B3624] text-center space-y-2">
                  <p className="text-xs text-[#8C9891]">
                    Outras aulas relacionadas aparecerão aqui conforme forem publicadas no catálogo.
                  </p>
                </div>
              )}

              <Link
                to={baseAcademyPath}
                className="w-full py-3 rounded-xl bg-[#07110B] border border-[#1B3624] hover:border-[#39FF88]/50 text-xs font-mono text-[#F5F7F5] flex items-center justify-center space-x-1.5 transition-colors"
              >
                <span>Ver Todas as Aulas do Catálogo</span>
                <ChevronRight className="w-4 h-4 text-[#39FF88]" />
              </Link>
            </div>
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

          <div className="flex items-center space-x-3">
            {user ? (
              <Link
                to={user.role === 'admin' ? '/admin/overview' : '/app/dashboard'}
                className="px-3.5 py-2 rounded-xl bg-[#39FF88] text-[#07110B] font-bold text-xs uppercase tracking-wider"
              >
                Meu Painel
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-3.5 py-2 rounded-xl bg-[#39FF88] text-[#07110B] font-bold text-xs uppercase tracking-wider"
              >
                Entrar / Jogar
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {pageBody}
        </main>
      </div>
    );
  }

  return pageBody;
}
