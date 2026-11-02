import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Play,
  Clock,
  CheckCircle2,
  Circle,
  Search,
  Filter,
  Sparkles,
  BookOpen,
  User,
  Layers,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Settings,
  Video
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const LEVEL_BADGE_STYLES = {
  Iniciante: 'bg-[#39FF88]/15 text-[#39FF88] border-[#39FF88]/30',
  Intermediário: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  Avançado: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
};

export default function AcademyPage() {
  const { user, isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isInsideAppLayout = location.pathname.startsWith('/app');
  const baseAcademyPath = isInsideAppLayout ? '/app/academy' : '/academy';

  const [catalogData, setCatalogData] = useState(null);
  const [skillsOverview, setSkillsOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const loadAcademy = useCallback(async () => {
    try {
      setError(null);
      const [overviewRes, catalogRes] = await Promise.all([
        api.getAcademyOverview(),
        api.getAcademyCatalog()
      ]);
      setSkillsOverview(overviewRes?.skills || []);
      setCatalogData(catalogRes);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o catálogo da Motion Tennis Academy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAcademy();
  }, [loadAcademy]);

  const handleToggleCompleted = async (e, lesson) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || isGuest) return;

    setTogglingId(lesson.id);
    try {
      await api.setAcademyLessonProgress(lesson.id, !lesson.completed);
      await loadAcademy();
    } catch (err) {
      alert(err.message || 'Erro ao atualizar conclusão da aula.');
    } finally {
      setTogglingId(null);
    }
  };

  const publishedLessons = catalogData?.lessons || [];
  const categories = catalogData?.categories || [];
  const initialSlots = catalogData?.initialModulesPreview || [];
  const userProgress = catalogData?.userProgress || null;

  const filteredLessons = publishedLessons.filter((lesson) => {
    if (selectedCategory !== 'Todas' && lesson.category !== selectedCategory) {
      return false;
    }
    if (selectedLevel !== 'Todos' && lesson.level !== selectedLevel) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = lesson.title?.toLowerCase().includes(q);
      const matchDesc = lesson.description?.toLowerCase().includes(q);
      const matchCat = lesson.category?.toLowerCase().includes(q);
      const matchProf = lesson.instructor?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchProf) return false;
    }
    return true;
  });

  const content = (
    <div className="space-y-8 pb-12" data-testid="academy-catalog-page">
      {/* Banner Principal: Motion Tennis Academy 100% Gratuita */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#0C1A11] via-[#102418] to-[#0C1A11] border border-[#39FF88]/30 relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="academy-free-badge"
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#39FF88]/15 border border-[#39FF88]/40 text-[#39FF88] text-xs font-mono uppercase tracking-wider font-bold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Acesso 100% Gratuito • Aberto para Todos</span>
              </span>

              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#07110B]/80 border border-[#1B3624] text-[#8C9891] text-xs font-mono">
                <Video className="w-3.5 h-3.5 text-[#39FF88]" />
                <span>{catalogData?.totalPublished || 0} Aulas Publicadas</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-wide uppercase text-[#F5F7F5]">
              MOTION TENNIS <span className="text-[#39FF88] text-glow-neon">ACADEMY</span>
            </h1>

            <p className="text-sm text-[#8C9891] leading-relaxed">
              Plataforma oficial de videoaulas técnicas e táticas do Motion Tennis. Todo o conteúdo é
              gratuito para visitantes, jogadores cadastrados e treinadores — sem assinaturas ou bloqueios.
            </p>
          </div>

          {/* Ações Rápidas (Admin ou Visitante) */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            {user?.role === 'admin' && (
              <Link
                to="/admin/academy"
                data-testid="btn-go-admin-academy"
                className="inline-flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-amber-400 text-[#07110B] font-black text-xs uppercase tracking-wider hover:bg-amber-300 transition-all shadow-lg"
              >
                <Settings className="w-4 h-4" />
                <span>Gerenciar Academy (Admin)</span>
              </Link>
            )}

            {!user && (
              <div className="p-3.5 rounded-2xl bg-[#07110B]/90 border border-[#1B3624] text-xs space-y-2 max-w-xs">
                <div className="flex items-center space-x-2 text-[#39FF88] font-bold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Assista Livremente Sem Login</span>
                </div>
                <p className="text-[11px] text-[#8C9891]">
                  Você pode assistir a todas as aulas publicadas agora mesmo. Para salvar suas aulas concluídas, entre com sua conta.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-1 text-[11px] font-mono font-bold text-[#39FF88] hover:underline"
                >
                  <span>Entrar com minha conta</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
        <GraduationCap className="w-48 h-48 text-[#39FF88]/5 absolute -right-6 -bottom-8 pointer-events-none" />
      </div>

      {/* Painel de Progresso do Aluno Autenticado */}
      {user && !isGuest && userProgress && (
        <div
          data-testid="academy-user-progress-panel"
          className="p-6 rounded-2xl bg-[#0C1A11] border border-[#1B3624] space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#39FF88] block">
                Evolução na Academy • Conta: {user.name}
              </span>
              <h2 className="text-lg font-bold text-[#F5F7F5]">
                Seu Progresso de Estudo Técnico
              </h2>
            </div>

            <div className="flex items-center space-x-4 bg-[#07110B] px-4 py-2.5 rounded-xl border border-[#1B3624]">
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#8C9891] block uppercase">Aulas Concluídas</span>
                <span className="text-lg font-black font-mono text-[#39FF88]" data-testid="academy-completed-count">
                  {userProgress.completedCount} / {userProgress.totalPublished}
                </span>
              </div>
              <div className="h-8 w-px bg-[#1B3624]" />
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#8C9891] block uppercase">Conclusão Geral</span>
                <span className="text-lg font-black font-mono text-[#F5F7F5]">
                  {userProgress.overallPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Barra geral */}
          <div className="h-2.5 w-full rounded-full bg-[#07110B] overflow-hidden border border-[#1B3624]">
            <div
              className="h-full bg-gradient-to-r from-[#1FA855] to-[#39FF88] transition-all duration-500"
              style={{ width: `${userProgress.overallPercent}%` }}
            />
          </div>

          {/* Progresso por Categoria */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="p-3 rounded-xl bg-[#07110B] border border-[#1B3624] flex flex-col justify-between space-y-2"
              >
                <span className="text-[11px] font-bold text-[#F5F7F5] line-clamp-1" title={cat.name}>
                  {cat.name}
                </span>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#8C9891]">
                  <span>
                    {cat.completedCount}/{cat.publishedCount} aulas
                  </span>
                  <span className="text-[#39FF88] font-bold">{cat.progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#0C1A11] overflow-hidden">
                  <div
                    className="h-full bg-[#39FF88]"
                    style={{ width: `${cat.progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de Busca e Filtros do Catálogo */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624] flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Busca por texto */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8C9891] absolute left-3.5 top-3.5" />
          <input
            type="text"
            data-testid="academy-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar videoaula por título, tema, categoria ou professor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07110B] border border-[#1B3624] text-sm text-[#F5F7F5] focus:border-[#39FF88] focus:outline-none"
          />
        </div>

        {/* Filtro de Categoria */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-[#39FF88]" />
            <span className="text-xs font-mono uppercase text-[#8C9891]">Categoria:</span>
            <select
              data-testid="academy-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#07110B] border border-[#1B3624] text-xs font-mono text-[#F5F7F5] focus:border-[#39FF88] focus:outline-none"
            >
              <option value="Todas">Todas as Categorias</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} ({cat.publishedCount})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Nível */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono uppercase text-[#8C9891]">Nível:</span>
            <select
              data-testid="academy-level-filter"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#07110B] border border-[#1B3624] text-xs font-mono text-[#F5F7F5] focus:border-[#39FF88] focus:outline-none"
            >
              <option value="Todos">Todos os Níveis</option>
              <option value="Iniciante">Iniciante</option>
              <option value="Intermediário">Intermediário</option>
              <option value="Avançado">Avançado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Seção Principal: Catálogo de Videoaulas Publicadas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-[#F5F7F5] flex items-center gap-2">
              <Play className="w-5 h-5 text-[#39FF88]" />
              <span>Catálogo de Videoaulas Disponíveis</span>
            </h2>
            <p className="text-xs text-[#8C9891]">
              Clique em qualquer aula publicada para abrir o player interno do Motion Tennis.
            </p>
          </div>
          <span className="text-xs font-mono text-[#39FF88] bg-[#39FF88]/10 px-3 py-1 rounded-lg border border-[#39FF88]/30">
            {filteredLessons.length} aula(s) exibida(s)
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {filteredLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="academy-published-grid">
            {filteredLessons.map((lesson) => {
              const levelStyle = LEVEL_BADGE_STYLES[lesson.level] || LEVEL_BADGE_STYLES.Iniciante;
              return (
                <div
                  key={lesson.id}
                  data-testid={`academy-lesson-card-${lesson.id}`}
                  onClick={() => navigate(`${baseAcademyPath}/aula/${lesson.id}`)}
                  className="group cursor-pointer rounded-2xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88] transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-[0_0_25px_rgba(57,255,136,0.12)]"
                >
                  <div>
                    {/* Capa da Aula (Thumbnail) */}
                    <div className="relative aspect-video bg-[#07110B] overflow-hidden border-b border-[#1B3624]">
                      {lesson.thumbnail ? (
                        <img
                          src={lesson.thumbnail}
                          alt={lesson.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#07110B] via-[#102216] to-[#07110B]">
                          <GraduationCap className="w-12 h-12 text-[#39FF88]/30" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-[#07110B] via-transparent to-black/30" />

                      {/* Botão Play Central */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-[#39FF88]/90 text-[#07110B] flex items-center justify-center shadow-[0_0_25px_rgba(57,255,136,0.6)] group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Badges Superiores */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-[#07110B]/90 border border-[#1B3624] text-[10px] font-mono uppercase tracking-wider text-[#39FF88] font-bold">
                          {lesson.category}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase font-bold ${levelStyle}`}>
                          {lesson.level}
                        </span>
                      </div>

                      {/* Duração e Status Concluída */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#07110B]/90 text-[#F5F7F5] text-[11px] font-mono">
                          <Clock className="w-3 h-3 text-[#39FF88]" />
                          <span>{lesson.duration}</span>
                        </span>

                        {lesson.completed && (
                          <span
                            data-testid={`lesson-completed-badge-${lesson.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#39FF88] text-[#07110B] text-[10px] font-mono font-black uppercase"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Concluída</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Corpo do Card */}
                    <div className="p-5 space-y-2.5">
                      <h3 className="text-base font-bold text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors line-clamp-2">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-[#8C9891] line-clamp-2 leading-relaxed">
                        {lesson.description}
                      </p>
                    </div>
                  </div>

                  {/* Rodapé do Card: Professor & Ações */}
                  <div className="px-5 pb-5 pt-3 border-t border-[#1B3624]/60 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-xs text-[#8C9891] truncate">
                      <User className="w-3.5 h-3.5 text-[#39FF88] shrink-0" />
                      <span className="truncate font-mono text-[11px]">
                        {lesson.instructor ? `Prof. ${lesson.instructor}` : 'Professor da Academy'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {user && !isGuest && (
                        <button
                          type="button"
                          data-testid={`btn-toggle-complete-${lesson.id}`}
                          disabled={togglingId === lesson.id}
                          onClick={(e) => handleToggleCompleted(e, lesson)}
                          title={lesson.completed ? 'Desmarcar conclusão' : 'Marcar aula como concluída'}
                          className={`p-2 rounded-lg border text-xs font-mono transition-colors ${
                            lesson.completed
                              ? 'bg-[#39FF88]/15 border-[#39FF88]/40 text-[#39FF88]'
                              : 'bg-[#07110B] border-[#1B3624] text-[#8C9891] hover:border-[#39FF88]/40 hover:text-[#F5F7F5]'
                          }`}
                        >
                          {lesson.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                        </button>
                      )}

                      <span className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#39FF88]/15 border border-[#39FF88]/30 text-[#39FF88] text-xs font-mono font-bold group-hover:bg-[#39FF88] group-hover:text-[#07110B] transition-colors">
                        <span>Assistir</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="academy-empty-published-notice"
            className="p-8 rounded-2xl bg-[#0C1A11] border border-[#1B3624] text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#102216] border border-[#39FF88]/30 flex items-center justify-center mx-auto text-[#39FF88]">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#F5F7F5]">
              {publishedLessons.length === 0
                ? 'Catálogo Preparado para as 12 Videoaulas Oficiais'
                : 'Nenhuma aula encontrada para os filtros selecionados'}
            </h3>
            <p className="text-xs text-[#8C9891] max-w-xl mx-auto leading-relaxed">
              {publishedLessons.length === 0
                ? 'A estrutura dos módulos da Motion Tennis Academy está pronta. Assim que as videoaulas forem publicadas pelo painel administrativo, elas ficarão disponíveis gratuitamente aqui.'
                : 'Tente alterar a categoria, o nível ou o termo pesquisado para visualizar outras aulas publicadas.'}
            </p>
          </div>
        )}
      </div>

      {/* Módulos de Aprendizagem de Tênis (6 Pilares Técnicos) */}
      <div className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wider text-[#F5F7F5] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#39FF88]" />
            <span>Módulos de Aprendizagem do Tênis</span>
          </h2>
          <p className="text-xs text-[#8C9891]">
            Explore as categorias fundamentais do programa técnico da Motion Tennis Academy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skillsOverview.map((skill) => (
            <Link
              to={`${baseAcademyPath}/${skill.key}`}
              key={skill.key}
              className="p-5 rounded-2xl bg-[#0C1A11] border border-[#1B3624] hover:border-[#39FF88]/60 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-[#07110B] border border-[#1B3624] flex items-center justify-center text-xl group-hover:border-[#39FF88]/40 transition-colors">
                      {skill.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#F5F7F5] group-hover:text-[#39FF88] transition-colors">
                        {skill.category || skill.name}
                      </h3>
                      <span className="text-[10px] font-mono text-[#39FF88] uppercase tracking-wider">
                        Módulo Técnico
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#07110B] border border-[#1B3624] text-[10px] font-mono text-[#8C9891]">
                    {skill.published_lessons || 0} publicada(s)
                  </span>
                </div>
                <p className="text-xs text-[#8C9891] leading-relaxed mb-4">
                  {skill.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#1B3624]/60 flex items-center justify-between text-xs font-mono text-[#39FF88]">
                <span>Ver módulo e treinos</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Grade Planejada das 12 Aulas Iniciais (exibida quando habilitada pelo Admin) */}
      {catalogData?.showComingSoon && initialSlots.length > 0 && (
        <div className="p-6 rounded-2xl bg-[#0C1A11]/80 border border-[#1B3624] space-y-4" data-testid="academy-12-slots-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#39FF88] block">
                Grade Pedagógica • 12 Videoaulas Iniciais
              </span>
              <h3 className="text-base font-bold text-[#F5F7F5]">
                Cronograma de Conteúdos da Motion Tennis Academy
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#8C9891]">
              Aulas sem vídeo publicado permanecem identificadas como &quot;Em breve&quot;
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {initialSlots.map((slot) => (
              <div
                key={slot.slot_number}
                onClick={() => {
                  if (slot.published && slot.id) {
                    navigate(`${baseAcademyPath}/aula/${slot.id}`);
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                  slot.published
                    ? 'bg-[#102216]/70 border-[#39FF88]/50 cursor-pointer hover:border-[#39FF88]'
                    : 'bg-[#07110B]/70 border-[#1B3624] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#8C9891]">
                    AULA {String(slot.slot_number).padStart(2, '0')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                      slot.published
                        ? 'bg-[#39FF88]/20 text-[#39FF88]'
                        : 'bg-[#1B3624] text-[#8C9891]'
                    }`}
                  >
                    {slot.published ? 'Publicado' : 'Em breve'}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F5F7F5] line-clamp-1">
                    {slot.category}
                  </div>
                  <div className="text-[11px] text-[#8C9891] line-clamp-1 mt-0.5">
                    {slot.published ? slot.title : 'Conteúdo em preparação com o professor'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[#39FF88] font-mono text-sm">
        CARREGANDO MOTION TENNIS ACADEMY...
      </div>
    );
  }

  // Se estiver sendo acessada pela rota pública /academy (fora do PlayerLayout), envolve com cabeçalho completo
  if (!isInsideAppLayout) {
    return (
      <div className="min-h-screen bg-[#07110B] text-[#F5F7F5] flex flex-col">
        <header className="sticky top-0 z-40 h-16 bg-[#0C1A11]/95 backdrop-blur-md border-b border-[#1B3624] px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="inline-flex items-center space-x-2 text-xs font-mono text-[#8C9891] hover:text-[#39FF88] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Início</span>
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
                Ir para Meu Painel
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-3.5 py-2 rounded-xl bg-[#39FF88] text-[#07110B] font-bold text-xs uppercase tracking-wider hover:bg-[#1FA855] transition-colors"
              >
                Entrar / Jogar
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {content}
        </main>
      </div>
    );
  }

  return content;
}
