import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  Play, 
  RotateCcw, 
  Square, 
  Maximize, 
  Minimize, 
  Volume2, 
  VolumeX, 
  Trophy, 
  Clock, 
  Zap, 
  CheckCircle2, 
  Settings,
  AlertCircle,
  Sparkles,
  LogIn,
  Sliders,
  Radio,
  Lock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  ArrowLeft
} from 'lucide-react';
import CourtTarget, { FIXED_SECTORS } from '../components/CourtTarget';
import ShoppingExperience from '../components/ShoppingExperience';
import IotDiagnosticPanel from '../components/IotDiagnosticPanel';
import { NICOLAS_WALL_OPTIONS } from '../services/wallGeometry';
import { api } from '../services/api';
import { playBallHit, playBullseye, playMiss, isSoundEnabled, setSoundEnabled } from '../services/sound';
import { wsClient } from '../services/websocket';
import { useAuth } from '../context/AuthContext';
import { isNativeMobile } from '../services/serverConfig';
import { isWebDemoMode } from '../services/appEnvironment';

const GAME_INFO = {
  free: {
    title: '1. Treino Livre',
    subtitle: 'Todos os 6 alvos disponíveis • +85 pts por acerto',
    description: 'Desfira golpes livres nos 6 setores retangulares da parede durante 05:00 para treinar consistência e precisão.'
  },
  single: {
    title: '2. Liga um por vez',
    subtitle: 'Apenas 1 alvo aceso por vez • +1 ponto por acerto no alvo ativo',
    description: 'Acerte exclusivamente o setor iluminado. A cada acerto, um novo setor diferente acende imediatamente.'
  },
  clear_all: {
    title: '3. Apagar todos',
    subtitle: 'Todos os 6 alvos começam acesos • +100 pts ao apagar (+500 bônus vitória)',
    description: 'Apague todos os 6 setores antes de 05:00. Cuidado: atingir um setor já apagado faz com que ele reacenda!'
  }
};

export default function PlayPage(props) {
  const isDemo = isWebDemoMode();
  const [mode, setMode] = useState(isDemo ? 'personal' : null);

  useEffect(() => {
    if (isDemo) return;
    let alive = true;
    api.getInstallation()
      .then((cfg) => { if (alive) setMode(cfg?.mode === 'shopping' ? 'shopping' : 'personal'); })
      .catch(() => { if (alive) setMode('personal'); });
    return () => { alive = false; };
  }, [isDemo]);

  if (isNativeMobile() && !isDemo) return <PersonalPlay {...props} isWebDemo={false} />;
  if (mode === null) {
    return <div className="p-12 text-center text-xs font-mono text-[#39FF88] animate-pulse">Carregando...</div>;
  }
  return mode === 'shopping' ? <ShoppingExperience /> : <PersonalPlay {...props} isWebDemo={isDemo} />;
}

function PersonalPlay({ isWebDemo = false }) {
  const { user, isGuest, exitGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  if (isNativeMobile()) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-[#0C1A11] border-2 border-[#1B3624] text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#102216] border border-[#39FF88]/40 flex items-center justify-center text-[#39FF88]">
          <Play className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase text-[#F5F7F5] tracking-tight">Modo Jogo de Projeção</h2>
          <p className="text-xs text-[#8C9891] leading-relaxed">
            A projeção interativa dos 6 setores foi concebida para a parede da quadra e deve ser executada no notebook conectado ao projetor.
          </p>
        </div>
        <Link
          to={isGuest ? '/login' : '/app/dashboard'}
          className="inline-block w-full py-3.5 rounded-xl btn-neon font-bold text-xs tracking-wider uppercase shadow-neon"
        >
          Voltar
        </Link>
      </div>
    );
  }

  const arenaContainerRef = useRef(null);

  // Modos de jogo: 'free', 'single', 'clear_all'
  const initialMode = searchParams.get('mode') || 'free';
  const [mode, setMode] = useState(['free', 'single', 'clear_all'].includes(initialMode) ? initialMode : 'free');

  // Ciclo de vida da partida: 'IDLE' (aguardando JOGAR), 'PREPARING' (contagem 5s), 'PLAYING' (05:00 ativo), 'FINISHED' (encerrada)
  const [plannedSeconds, setPlannedSeconds] = useState(300);
  const [matchId, setMatchId] = useState(null);
  const matchIdRef = useRef(null);
  const [matchStatus, setMatchStatus] = useState('IDLE');
  const [matchStartedAt, setMatchStartedAt] = useState(null); // Timestamp em que PREPARING termina e ACTIVE começa
  const [matchEndsAt, setMatchEndsAt] = useState(null);       // Timestamp em que ACTIVE (300s) termina
  const [usedDurationSeconds, setUsedDurationSeconds] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [startingMatch, setStartingMatch] = useState(false);
  const serverOffsetRef = useRef(0);
  const [sessionId, setSessionId] = useState(() => 'sess_' + Date.now());

  const [syncState, setSyncState] = useState({
    status: 'idle',
    hitId: null,
    message: null
  });

  const [wallConfig, setWallConfig] = useState({
    preset: '3x2',
    width: 3.0,
    height: 2.0,
    label: '3 × 2 metros',
    aspectRatio: '3/2',
    canConfigureWall: false,
    sensors: null,
    sensorOffsetsCm: null
  });
  const [savingWall, setSavingWall] = useState(false);
  const [wallFeedback, setWallFeedback] = useState(null);
  const [showIotPanel, setShowIotPanel] = useState(false);
  const [showWallAccordion, setShowWallAccordion] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [score, setScore] = useState(0);
  const [shotsCount, setShotsCount] = useState(0);
  const [hitsCount, setHitsCount] = useState(0);
  const [sectorHits, setSectorHits] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const [lastHitSectorId, setLastHitSectorId] = useState(null);
  const [lastImpactCoords, setLastImpactCoords] = useState(null);
  const [lastFeedbackText, setLastFeedbackText] = useState('Selecione o modo e clique em JOGAR para iniciar a contagem de 5 segundos.');
  const [syncWarning, setSyncWarning] = useState(null);

  const [activeSectorId, setActiveSectorId] = useState(1);
  const [sectorStates, setSectorStates] = useState(() => {
    const init = {};
    FIXED_SECTORS.forEach(s => { init[s.id] = true; });
    return init;
  });
  const [reactivations, setReactivations] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  const recentLocalEvents = useRef(new Set());

  const applyBackendMatchState = (m) => {
    if (!m) return;
    const clientNow = Date.now();
    if (m.serverNow) {
      serverOffsetRef.current = m.serverNow - clientNow;
    }
    setNowTick(clientNow);
    setMatchId(m.id);
    matchIdRef.current = m.id;
    if (m.sessionId) setSessionId(m.sessionId);
    if (m.plannedSeconds) setPlannedSeconds(m.plannedSeconds);
    setScore(m.score ?? 0);
    setShotsCount(m.shots ?? 0);
    setHitsCount(m.hits ?? 0);
    setReactivations(m.reactivations ?? 0);
    if (m.sectorHits) setSectorHits(m.sectorHits);
    if (m.activeSector) setActiveSectorId(m.activeSector);
    if (m.sectorStates) setSectorStates(m.sectorStates);
    if (m.durationSeconds !== undefined) setUsedDurationSeconds(m.durationSeconds);

    setMatchStartedAt(m.startedAt || null);

    if (m.state === 'PREPARING') {
      setMatchEndsAt(m.endsAt);
      setGameWon(false);
      setMatchStatus('PREPARING');
    } else if (m.state === 'ACTIVE') {
      setMatchEndsAt(m.endsAt);
      setGameWon(false);
      setMatchStatus('PLAYING');
    } else if (m.state === 'CANCELLED') {
      prepareIdleGame(m.mode || mode, m.plannedSeconds || 300);
    } else {
      setMatchEndsAt(null);
      const isWon = Boolean(m.won || m.state === 'WON' || m.endReason === 'WON');
      setGameWon(isWon);
      setMatchStatus('FINISHED');
    }
  };

  // 1. Carrega a configuração da parede na inicialização
  useEffect(() => {
    if (isWebDemo) return;
    let isMounted = true;
    api.getWallConfig()
      .then((cfg) => {
        if (isMounted && cfg) {
          const geo = cfg.geometry || cfg;
          setWallConfig({
            preset: cfg.preset || '3x2',
            width: cfg.widthM || geo.width || 3.0,
            height: cfg.heightM || geo.height || 2.0,
            label: cfg.label || geo.label || '3 × 2 metros',
            aspectRatio: cfg.aspectRatio || geo.aspectRatio || '3/2',
            canConfigureWall: Boolean(cfg.canConfigureWall),
            sensors: cfg.sensors || geo.sensors || null,
            sensorOffsetsCm: cfg.sensorOffsetsCm || null
          });
        }
      })
      .catch(() => {});

    const unsubWall = wsClient.on('WALL_CONFIG_UPDATED', (payload) => {
      if (payload) {
        if (payload.userId && user?.id && Number(payload.userId) !== Number(user.id)) {
          return;
        }
        const geo = payload.geometry || payload;
        setWallConfig((prev) => ({
          ...prev,
          preset: payload.preset || prev.preset,
          width: payload.widthM || geo.width || prev.width,
          height: payload.heightM || geo.height || prev.height,
          label: payload.label || geo.label || prev.label,
          aspectRatio: payload.aspectRatio || geo.aspectRatio || prev.aspectRatio,
          sensors: payload.sensors || geo.sensors || prev.sensors,
          sensorOffsetsCm: payload.sensorOffsetsCm || prev.sensorOffsetsCm
        }));
      }
    });

    const unsubMatch = wsClient.on('PERSONAL_MATCH_UPDATED', (m) => {
      if (!m || isGuest) return;
      if (matchIdRef.current && m.id === matchIdRef.current) {
        applyBackendMatchState(m);
      }
    });

    return () => {
      isMounted = false;
      unsubWall();
      unsubMatch();
    };
  }, [isGuest, user?.id]);

  // Altera o tamanho físico da parede (exclusivo para a conta do Nicolas antes de iniciar a partida)
  const handleSelectNicolasWallPreset = async (newPreset) => {
    if (!wallConfig.canConfigureWall || savingWall) return;
    if (matchStatus === 'PREPARING' || matchStatus === 'PLAYING') {
      setWallFeedback({
        ok: false,
        text: 'Não é permitido alterar o tamanho da parede durante uma partida em andamento.'
      });
      return;
    }

    setSavingWall(true);
    setWallFeedback(null);
    try {
      const cfg = await api.updateMyWallConfig({ preset: newPreset });
      const geo = cfg.geometry || cfg;
      setWallConfig((prev) => ({
        ...prev,
        preset: cfg.preset || newPreset,
        width: cfg.widthM || geo.width || prev.width,
        height: cfg.heightM || geo.height || prev.height,
        label: cfg.label || geo.label || prev.label,
        aspectRatio: cfg.aspectRatio || geo.aspectRatio || prev.aspectRatio,
        sensors: cfg.sensors || geo.sensors || prev.sensors,
        sensorOffsetsCm: cfg.sensorOffsetsCm || prev.sensorOffsetsCm
      }));
      setWallFeedback({
        ok: true,
        text: `Parede configurada para ${cfg.label || newPreset} (${cfg.widthM}m × ${cfg.heightM}m) e salva no banco SQLite.`
      });
    } catch (err) {
      setWallFeedback({
        ok: false,
        text: err.message || 'Erro ao atualizar tamanho da parede.'
      });
    } finally {
      setSavingWall(false);
    }
  };

  // 2. Sincroniza query parameter 'mode'
  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode && ['free', 'single', 'clear_all'].includes(qMode) && qMode !== mode) {
      setMode(qMode);
    }
  }, [searchParams]);

  // 3. Consulta o backend na inicialização / F5 / troca de modo:
  //    IMPORTANTE (PARTE A - ITEM 1):
  //    - Se já houver partida PREPARING ou ACTIVE para este modo (ex.: F5), recupera sem reiniciar o cronômetro.
  //    - Se NÃO houver partida em andamento para este modo, permanece em IDLE com o cronômetro parado em 05:00
  //      aguardando o jogador clicar no botão JOGAR!
  useEffect(() => {
    if (isWebDemo) {
      prepareIdleGame(mode, 300);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const data = await api.personalMatch.getCurrent(mode);
        if (!alive) return;
        if (data?.serverNow) {
          serverOffsetRef.current = data.serverNow - Date.now();
        }
        const pSec = data?.plannedSeconds || 300;
        setPlannedSeconds(pSec);

        if (data?.match && (data.match.state === 'PREPARING' || data.match.state === 'ACTIVE')) {
          applyBackendMatchState(data.match);
          if (data.match.state === 'PREPARING') {
            setLastFeedbackText('Preparação em andamento! Prepare-se para o início da partida.');
          } else {
            setLastFeedbackText('Partida de 05:00 em andamento — sincronizada com o servidor.');
          }
          return;
        }

        // Permanece em IDLE aguardando o botão JOGAR (NÃO inicia automaticamente!)
        prepareIdleGame(mode, pSec);
      } catch (err) {
        if (alive) prepareIdleGame(mode, 300);
      }
    })();
    return () => { alive = false; };
  }, [mode]);

  // 4. Relógio visual contínuo (100ms para precisão da contagem 5,4,3,2,1,JÁ!) + sincronização com o backend
  useEffect(() => {
    const tick = setInterval(() => {
      setNowTick(Date.now());
    }, 100);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (isWebDemo || (matchStatus !== 'PREPARING' && matchStatus !== 'PLAYING')) return undefined;
    const poll = setInterval(() => {
      api.personalMatch.getCurrent(mode)
        .then((data) => {
          if (data?.serverNow) {
            serverOffsetRef.current = data.serverNow - Date.now();
          }
          if (data?.match && (data.match.state === 'PREPARING' || data.match.state === 'ACTIVE')) {
            applyBackendMatchState(data.match);
          } else if (data?.lastMatch && matchIdRef.current && data.lastMatch.id === matchIdRef.current) {
            applyBackendMatchState(data.lastMatch);
            setLastFeedbackText('Tempo limite de 05:00 encerrado!');
          }
        })
        .catch(() => {});
    }, 500);
    return () => clearInterval(poll);
  }, [matchStatus, mode]);

  const serverNow = nowTick + serverOffsetRef.current;

  // Cálculo da preparação de 5 segundos controlada pelo servidor
  const prepRemainingMs = matchStartedAt ? Math.max(0, matchStartedAt - serverNow) : 0;
  const prepRemainingSeconds = Math.ceil(prepRemainingMs / 1000);
  const msSinceOfficialStart = matchStartedAt ? serverNow - matchStartedAt : -1;

  // Transição local imediata quando prepRemainingMs zera, enquanto o poll de 500ms confirma ACTIVE no servidor
  useEffect(() => {
    if (matchStatus === 'PREPARING' && matchStartedAt && prepRemainingMs <= 0) {
      setMatchStatus('PLAYING');
      setLastFeedbackText(
        mode === 'single'
          ? `JÁ! Partida iniciada! Acerte o Setor ${activeSectorId}.`
          : mode === 'clear_all'
            ? 'JÁ! Partida iniciada! Apague todos os 6 setores.'
            : 'JÁ! Partida iniciada! Todos os 6 setores disponíveis.'
      );
      api.personalMatch.getCurrent(mode)
        .then((data) => {
          if (data?.match) applyBackendMatchState(data.match);
        })
        .catch(() => {});
    }
  }, [matchStatus, matchStartedAt, prepRemainingMs, mode, activeSectorId]);

  // Exibe "JÁ!" brevemente (700ms) no exato instante em que a contagem de 5s chega a zero
  const showGoBanner = (matchStatus === 'PLAYING' || matchStatus === 'PREPARING') &&
    matchStartedAt !== null &&
    msSinceOfficialStart >= 0 &&
    msSinceOfficialStart < 700;

  const showCountdownOverlay = (matchStatus === 'PREPARING' && prepRemainingMs > 0) || showGoBanner;
  const countdownText = showGoBanner
    ? 'JÁ!'
    : String(Math.max(1, Math.min(5, prepRemainingSeconds)));

  // Durante IDLE ou PREPARING, o cronômetro de 5 minutos fica parado em 05:00 (plannedSeconds)
  const remainingMs = matchStatus === 'PLAYING' && matchEndsAt
    ? Math.max(0, Math.min(plannedSeconds * 1000, matchEndsAt - serverNow))
    : (matchStatus === 'IDLE' || matchStatus === 'PREPARING')
      ? plannedSeconds * 1000
      : 0;

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const timerProgressPct = matchStatus === 'PLAYING' && plannedSeconds > 0
    ? Math.min(100, Math.max(0, ((plannedSeconds - remainingSeconds) / plannedSeconds) * 100))
    : 0;

  // Quando o cronômetro de 05:00 chega a 00:00, sincroniza e finaliza
  useEffect(() => {
    if (matchStatus === 'PLAYING' && matchEndsAt && remainingSeconds <= 0) {
      api.personalMatch.getCurrent(mode)
        .then((data) => {
          if (data?.match && data.match.state === 'ACTIVE') {
            applyBackendMatchState(data.match);
          } else if (data?.lastMatch) {
            applyBackendMatchState(data.lastMatch);
            setLastFeedbackText('Tempo limite de 05:00 encerrado!');
          } else {
            setMatchStatus('FINISHED');
            setUsedDurationSeconds(plannedSeconds);
            setLastFeedbackText('Tempo limite de 05:00 encerrado! Partida finalizada.');
          }
        })
        .catch(() => {
          setMatchStatus('FINISHED');
          setUsedDurationSeconds(plannedSeconds);
        });
    }
  }, [matchStatus, matchEndsAt, remainingSeconds, mode, plannedSeconds]);

  // 5. Escuta de impactos externos de hardware
  useEffect(() => {
    const unsubHit = wsClient.on('HIT_REGISTERED', (payload) => {
      if (!payload || !payload.hit || isGuest) return;

      if (payload.client_event_id && recentLocalEvents.current.has(payload.client_event_id)) {
        recentLocalEvents.current.delete(payload.client_event_id);
        return;
      }

      if (payload.match && matchIdRef.current && payload.match.id === matchIdRef.current) {
        applyBackendMatchState(payload.match);
      }
      setLastHitSectorId(payload.hit.sensor_id || null);
      setLastImpactCoords({ x: payload.hit.x, y: payload.hit.y, hit: Boolean(payload.hit.is_hit) });
    });

    return () => unsubHit();
  }, [isGuest]);

  const prepareIdleGame = (gameMode, durationSec = 300) => {
    setMatchId(null);
    matchIdRef.current = null;
    setMatchStartedAt(null);
    setMatchEndsAt(null);
    setUsedDurationSeconds(0);
    setPlannedSeconds(durationSec);
    setShotsCount(0);
    setHitsCount(0);
    setScore(0);
    setSectorHits({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    setLastHitSectorId(null);
    setLastImpactCoords(null);
    setGameWon(false);
    setMatchStatus('IDLE');
    setReactivations(0);
    setSyncWarning(null);
    setSyncState({ status: 'idle', hitId: null, message: null });

    if (gameMode === 'single') {
      setActiveSectorId(1);
      setLastFeedbackText('Liga um por vez selecionado. Clique em JOGAR para iniciar a contagem de 5 segundos.');
    } else if (gameMode === 'clear_all') {
      const allOn = {};
      FIXED_SECTORS.forEach(s => { allOn[s.id] = true; });
      setSectorStates(allOn);
      setLastFeedbackText('Apagar Todos selecionado. Clique em JOGAR para iniciar a contagem de 5 segundos.');
    } else {
      setLastFeedbackText('Treino Livre selecionado. Clique em JOGAR para iniciar a contagem de 5 segundos.');
    }
  };

  // Clicar no botão JOGAR: inicia estado PREPARING (5s) no backend
  const handleStartMatch = async (forceNew = false) => {
    if (startingMatch) return;
    if (!forceNew && (matchStatus === 'PREPARING' || matchStatus === 'PLAYING')) return;

    if (isWebDemo) {
      const now = Date.now();
      const demoMatch = {
        id: 'demo_' + now,
        mode,
        state: 'PREPARING',
        startedAt: now + 5000,
        endsAt: now + 305000,
        plannedSeconds: 300,
        score: 0,
        shots: 0,
        hits: 0,
        reactivations: 0,
        activeSector: mode === 'single' ? Math.floor(Math.random() * 6) + 1 : 1,
        sectorStates: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
        durationSeconds: 0
      };
      setLastHitSectorId(null);
      setLastImpactCoords(null);
      applyBackendMatchState(demoMatch);
      setLastFeedbackText('Prepare-se! A partida começará após a contagem de 5 segundos.');
      return;
    }

    setStartingMatch(true);
    setSyncWarning(null);
    try {
      const res = await api.personalMatch.start({
        mode,
        forceNew: Boolean(forceNew || matchStatus === 'FINISHED'),
        equipment_id: user?.equipment?.id || 1
      });
      if (res?.match) {
        setLastHitSectorId(null);
        setLastImpactCoords(null);
        applyBackendMatchState(res.match);
        setLastFeedbackText('Prepare-se! A partida começará após a contagem de 5 segundos.');
      }
    } catch (err) {
      setSyncWarning(err.message || 'Falha ao iniciar partida no servidor.');
    } finally {
      setStartingMatch(false);
    }
  };

  // Cancelar durante PREPARING ou encerrar manualmente durante PLAYING
  const handleEndOrCancelMatch = async () => {
    const wasPreparing = matchStatus === 'PREPARING';

    if (isWebDemo) {
      if (wasPreparing) {
        prepareIdleGame(mode, plannedSeconds);
        setLastFeedbackText('Contagem cancelada. Nenhuma sessão foi registrada.');
      } else {
        setMatchStatus('FINISHED');
        setLastFeedbackText('Partida demonstrativa encerrada.');
      }
      return;
    }

    try {
      const res = await api.personalMatch.finish({ match_id: matchIdRef.current });
      if (wasPreparing || res?.match?.state === 'CANCELLED') {
        prepareIdleGame(mode, plannedSeconds);
        setLastFeedbackText('Contagem cancelada. Nenhuma sessão foi registrada.');
        return;
      }
      if (res?.match) {
        applyBackendMatchState(res.match);
        if (!isGuest) {
          setSyncState({
            status: 'persisted',
            hitId: null,
            message: 'Sessão oficial salva no SQLite'
          });
        }
      } else {
        setMatchStatus('FINISHED');
      }
      setLastFeedbackText('Partida encerrada! Confira o resultado.');
    } catch (err) {
      if (wasPreparing) {
        prepareIdleGame(mode, plannedSeconds);
      } else {
        setMatchStatus('FINISHED');
      }
    }
  };

  // Trocar de modo de jogo: NUNCA inicia cronômetro nem cria partida ACTIVE
  const handleModeChange = async (newMode) => {
    if (newMode === mode) return;
    if ((matchStatus === 'PREPARING' || matchStatus === 'PLAYING') && matchIdRef.current) {
      try {
        await api.personalMatch.finish({ match_id: matchIdRef.current });
      } catch (e) {}
    }
    prepareIdleGame(newMode, plannedSeconds);
    setMode(newMode);
    setSearchParams({ mode: newMode });
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (arenaContainerRef.current?.requestFullscreen) {
        arenaContainerRef.current.requestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleExitGuestToLogin = async () => {
    await exitGuest();
    navigate('/login');
  };

  // =========================================================================
  // PROCESSAMENTO CENTRAL DE IMPACTO (BLOQUEADO EM IDLE, PREPARING E FINISHED)
  // =========================================================================
  const sendImpactToBackend = async ({ sectorId, x, y, isNeutral = false }) => {
    if (matchStatus !== 'PLAYING' || showCountdownOverlay || gameWon || remainingSeconds <= 0) {
      return;
    }

    const clientEventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    recentLocalEvents.current.add(clientEventId);

    setLastImpactCoords({ x, y, hit: !isNeutral });
    setSyncState({
      status: 'simulated',
      hitId: null,
      message: isWebDemo ? 'Impacto demonstrativo em memória' : 'Impacto simulado localmente'
    });

    if (isWebDemo) {
      setShotsCount((prev) => prev + 1);

      if (isNeutral) {
        setLastHitSectorId(null);
        setLastFeedbackText('Espaçamento entre alvos atingido! Área neutra — 0 pontos.');
        playMiss();
        return;
      }

      const hitSector = Number(sectorId);
      setLastHitSectorId(hitSector);

      if (mode === 'free') {
        setHitsCount((prev) => prev + 1);
        setScore((prev) => prev + 85);
        setSectorHits((prev) => ({ ...prev, [hitSector]: (prev[hitSector] || 0) + 1 }));
        playBallHit(88);
        setLastFeedbackText(`Setor ${hitSector} atingido! +85 pts`);
      } else if (mode === 'single') {
        if (hitSector === activeSectorId) {
          setHitsCount((prev) => prev + 1);
          setScore((prev) => prev + 1);
          setSectorHits((prev) => ({ ...prev, [hitSector]: (prev[hitSector] || 0) + 1 }));
          const others = [1, 2, 3, 4, 5, 6].filter((s) => s !== hitSector);
          const nextSector = others[Math.floor(Math.random() * others.length)];
          setActiveSectorId(nextSector);
          playBullseye();
          setLastFeedbackText(`Ponto! Setor ${hitSector} acertado. Próximo alvo: Setor ${nextSector}`);
        } else {
          playMiss();
          setLastFeedbackText(`Erro! O setor aceso é o Setor ${activeSectorId}.`);
        }
      } else if (mode === 'clear_all') {
        const isLit = sectorStates[hitSector] !== false;
        if (isLit) {
          const nextStates = { ...sectorStates, [hitSector]: false };
          setSectorStates(nextStates);
          setHitsCount((prev) => prev + 1);
          setSectorHits((prev) => ({ ...prev, [hitSector]: (prev[hitSector] || 0) + 1 }));

          const allOff = [1, 2, 3, 4, 5, 6].every((s) => nextStates[s] === false);
          if (allOff) {
            setGameWon(true);
            setMatchStatus('FINISHED');
            setScore((prev) => prev + 100 + 500);
            playBullseye();
            setLastFeedbackText('DESAFIO CONCLUÍDO! Todos os 6 setores foram apagados (+500 pts bônus)!');
          } else {
            setScore((prev) => prev + 100);
            playBallHit(90);
            setLastFeedbackText(`Excelente! Setor ${hitSector} APAGADO.`);
          }
        } else {
          setSectorStates((prev) => ({ ...prev, [hitSector]: true }));
          setReactivations((prev) => prev + 1);
          playMiss();
          setLastFeedbackText(`Atenção: Setor ${hitSector} foi REACENDIDO!`);
        }
      }
      return;
    }

    try {
      const res = await api.sendHardwareHit({
        match_id: matchIdRef.current || null,
        sector_id: isNeutral ? null : Number(sectorId),
        target_id: isNeutral ? null : Number(sectorId),
        x,
        y,
        speed: isNeutral ? 80 : 88,
        game_mode: mode,
        target_sensor_id: activeSectorId,
        equipment_id: user?.equipment?.id || 1,
        source: 'mouse',
        is_simulation: true,
        client_event_id: clientEventId,
        session_id: isGuest ? null : sessionId
      });

      if (res?.received_by_backend) {
        setSyncState({
          status: 'received',
          hitId: null,
          message: 'Impacto recebido pelo backend'
        });
      }

      const payload = res?.data || res;
      const savedHitId = res?.hit_id || payload?.hit_id || payload?.hit?.id;
      const matchData = payload?.match;

      if (matchData) {
        applyBackendMatchState(matchData);
      }

      if (isNeutral || payload?.reason === 'NEUTRAL_AREA') {
        setLastHitSectorId(null);
        setLastFeedbackText('Espaçamento entre alvos atingido! Área neutra — 0 pontos.');
        playMiss();
      } else {
        const hitSector = Number(sectorId);
        setLastHitSectorId(hitSector);

        if (payload?.won || matchData?.state === 'WON') {
          playBullseye();
          setLastFeedbackText('DESAFIO CONCLUÍDO! Todos os 6 setores foram apagados.');
        } else if (payload?.reactivated || payload?.reason === 'REACTIVATED') {
          playMiss();
          setLastFeedbackText(`Atenção: Setor ${hitSector} foi REACENDIDO!`);
        } else if (payload?.reason === 'WRONG_SECTOR') {
          playMiss();
          setLastFeedbackText(`Erro! O setor aceso é o Setor ${matchData?.activeSector || activeSectorId}.`);
        } else if (mode === 'single' && payload?.is_match_hit) {
          playBullseye();
          setLastFeedbackText(`Ponto! Setor ${hitSector} acertado. Próximo alvo: Setor ${matchData?.activeSector}`);
        } else if (mode === 'clear_all' && payload?.is_match_hit) {
          playBallHit(90);
          setLastFeedbackText(`Excelente! Setor ${hitSector} APAGADO.`);
        } else {
          playBallHit(88);
          setLastFeedbackText(`Setor ${hitSector} atingido! +${payload?.match_points ?? 85} pts`);
        }
      }

      if (isGuest || res?.is_guest) {
        setSyncState({
          status: 'persisted',
          hitId: null,
          message: 'Pontuação temporária atualizada (Visitante)'
        });
        setSyncWarning(null);
      } else if (res?.persisted_in_db || payload?.persisted_in_db) {
        setSyncState({
          status: 'persisted',
          hitId: savedHitId,
          message: savedHitId ? `Impacto salvo no SQLite (#${savedHitId})` : 'Impacto salvo no SQLite'
        });
        setSyncWarning(null);
      }
    } catch (err) {
      if (err.data?.reason === 'PREPARING_BLOCKED') {
        setLastFeedbackText('Aguarde o fim da contagem de 5 segundos (JÁ!) para pontuar.');
        return;
      }
      if (err.message && err.message.includes('Partida encerrada')) {
        setMatchStatus('FINISHED');
        setLastFeedbackText('Partida encerrada. Clique em JOGAR NOVAMENTE para continuar.');
        return;
      }
      setSyncState({
        status: 'error',
        hitId: null,
        message: 'Falha ao comunicar impacto'
      });
      setSyncWarning(`Falha de comunicação com o servidor: ${err.message || 'verifique se o backend está ativo.'}`);
    }
  };

  const handleWallSectorHit = (hitData) => {
    if (!hitData) return;
    if (matchStatus !== 'PLAYING' || showCountdownOverlay || gameWon || remainingSeconds <= 0) return;

    const { hit, sectorId, x, y, classification } = hitData;
    if (hit === false || classification === 'NEUTRAL_AREA') {
      sendImpactToBackend({ sectorId: null, x, y, isNeutral: true });
      return;
    }
    sendImpactToBackend({ sectorId, x, y, isNeutral: false });
  };

  const accuracyRate = shotsCount > 0 ? Math.round((hitsCount / shotsCount) * 100) : 0;
  const activeSectorsLeft = Object.values(sectorStates).filter((v) => v === true).length;

  const formatTime = (seconds) => {
    const total = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentInfo = GAME_INFO[mode] || GAME_INFO.free;

  return (
    <div ref={arenaContainerRef} className="space-y-4 max-w-6xl mx-auto">

      {/* ========================================================================= */}
      {/* ETAPA 2 — MODO FOCO (TELA CHEIA IMERSIVA DE JOGO QUANDO EM ANDAMENTO)     */}
      {/* ========================================================================= */}
      {(matchStatus === 'PREPARING' || matchStatus === 'PLAYING') && (
        <div
          data-testid="focus-game-viewport"
          className="fixed inset-0 z-50 bg-[#050D07] flex flex-col justify-between p-3 sm:p-5 overflow-hidden select-none"
        >
          {/* HUD SUPERIOR COMPACTO */}
          <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#09150E]/90 border border-[#16C96B]/30 shadow-xl backdrop-blur-md">
            {/* Esquerda: Modo e Status */}
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 rounded-xl bg-[#102216] border border-[#39FF88]/40 text-xs font-mono font-bold text-[#39FF88] shadow-sm">
                {currentInfo.title}
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#07110B] border border-[#16291C] text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${matchStatus === 'PLAYING' ? 'bg-[#39FF88] animate-ping' : 'bg-amber-400 animate-ping'}`} />
                <span data-testid="match-status-label" className={`font-bold ${matchStatus === 'PLAYING' ? 'text-[#39FF88]' : 'text-amber-400'}`}>
                  {matchStatus === 'PLAYING' ? 'EM ANDAMENTO' : `PREPARANDO (${prepRemainingSeconds}s)`}
                </span>
              </div>
            </div>

            {/* Centro: Cronômetro, Pontos, Golpes, Precisão */}
            <div className="flex items-center gap-4 sm:gap-6 font-mono">
              <div className="text-center">
                <div className="text-[10px] text-[#8C9891] uppercase">Tempo</div>
                <div
                  data-testid="personal-timer-display"
                  className={`text-xl sm:text-2xl font-black ${
                    remainingSeconds <= 30 && matchStatus === 'PLAYING' ? 'text-rose-400 animate-pulse' : 'text-[#39FF88]'
                  }`}
                >
                  {formatTime(remainingSeconds)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-[10px] text-[#8C9891] uppercase">Pontos</div>
                <div data-testid="personal-score-value" className="text-xl sm:text-2xl font-black text-[#F5F7F5]">
                  {score}
                </div>
              </div>

              <div className="text-center hidden sm:block">
                <div className="text-[10px] text-[#8C9891] uppercase">Golpes</div>
                <div data-testid="personal-shots-count" className="text-xl sm:text-2xl font-black text-[#F5F7F5]">
                  {shotsCount}
                </div>
              </div>

              <div className="text-center">
                <div className="text-[10px] text-[#8C9891] uppercase">
                  {mode === 'clear_all' ? 'Acesos' : 'Precisão'}
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#39FF88]">
                  {mode === 'clear_all' ? `${activeSectorsLeft}/6` : `${accuracyRate}%`}
                </div>
              </div>
            </div>

            {/* Direita: Som, Tela Cheia e Botão SAIR com Confirmação */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleSound}
                title={soundOn ? 'Desativar som' : 'Ativar som'}
                className="p-2 rounded-xl bg-[#08130C] border border-[#16291C] text-[#8C9891] hover:text-[#39FF88] transition-all"
              >
                {soundOn ? <Volume2 size={16} className="text-[#39FF88]" /> : <VolumeX size={16} />}
              </button>

              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Sair da Tela Cheia' : 'Modo Tela Cheia (Projetor)'}
                className="p-2 rounded-xl bg-[#08130C] border border-[#16291C] text-[#8C9891] hover:text-[#39FF88] transition-all hidden sm:flex"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>

              {matchStatus === 'PREPARING' ? (
                <button
                  data-testid="btn-cancel-prepare"
                  onClick={handleEndOrCancelMatch}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-mono font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-sm"
                >
                  <Square size={13} className="fill-current" />
                  <span>Cancelar</span>
                </button>
              ) : (
                <button
                  data-testid="btn-end-match"
                  onClick={() => setShowExitModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 font-mono font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-sm"
                >
                  <Square size={13} className="fill-current" />
                  <span>SAIR</span>
                </button>
              )}
            </div>
          </div>

          {/* ÁREA CENTRAL MAXIMIZADA DA PAREDE (6 SETORES) */}
          <div className="flex-1 w-full max-w-7xl mx-auto relative flex items-center justify-center my-auto min-h-0">
            <CourtTarget
              gameMode={mode}
              activeSectorId={activeSectorId}
              activeTargetId={activeSectorId}
              sectorStates={sectorStates}
              targetStates={sectorStates}
              lastHitSectorId={lastHitSectorId}
              lastHitTargetId={lastHitSectorId}
              lastImpactCoords={lastImpactCoords}
              onSectorHit={handleWallSectorHit}
              onTargetHit={handleWallSectorHit}
              interactive={matchStatus === 'PLAYING' && !showCountdownOverlay && remainingSeconds > 0 && !gameWon}
              wallPreset={wallConfig.preset}
              sensorOffsetsCm={wallConfig.sensorOffsetsCm}
              isFullscreen={true}
            />

            {/* CONTAGEM REGRESSIVA CENTRAL 5, 4, 3, 2, 1, JÁ! */}
            {showCountdownOverlay && (
              <div
                data-testid="countdown-overlay"
                className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-3xl bg-[#050D07]/90 backdrop-blur-md border-2 border-[#39FF88]/60 select-none pointer-events-auto shadow-[0_0_60px_rgba(57,255,136,0.25)]"
              >
                <div className="text-xs sm:text-sm font-mono uppercase tracking-[0.3em] text-[#8C9891] mb-2 font-bold">
                  {showGoBanner ? 'PARTIDA INICIADA' : 'PREPARE-SE PARA JOGAR'}
                </div>
                <div
                  data-testid="countdown-number"
                  className="text-[7rem] sm:text-[11rem] leading-none font-black font-mono text-[#39FF88] drop-shadow-[0_0_55px_rgba(57,255,136,0.85)] animate-pulse"
                >
                  {countdownText}
                </div>
                <div className="mt-4 text-xs font-mono text-[#F5F7F5]/80">
                  {showGoBanner ? 'Acerte os alvos na parede!' : 'Impactos bloqueados durante a preparação'}
                </div>
              </div>
            )}
          </div>

          {/* MODAL DE CONFIRMAÇÃO DE SAÍDA */}
          {showExitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
              <div className="max-w-sm w-full p-6 rounded-3xl bg-[#0C1A11] border-2 border-rose-500/50 shadow-2xl text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-[#F5F7F5] uppercase tracking-wide">
                    Encerrar Partida?
                  </h3>
                  <p className="text-xs text-[#8C9891] leading-relaxed">
                    Deseja realmente sair da partida em andamento? O resultado atual será gravado e exibido no resumo.
                  </p>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => setShowExitModal(false)}
                    className="flex-1 py-3 rounded-xl bg-[#07110B] border border-[#1B3624] text-xs font-mono font-bold text-[#F5F7F5] hover:border-[#39FF88]/50 transition-all"
                  >
                    Continuar Jogando
                  </button>
                  <button
                    onClick={() => {
                      setShowExitModal(false);
                      handleEndOrCancelMatch();
                    }}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-mono font-black uppercase text-white shadow-lg transition-all"
                  >
                    Encerrar Partida
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 3 — TELA DE RESULTADO (SUMMARY APÓS TÉRMINO DA PARTIDA)             */}
      {/* ========================================================================= */}
      {(matchStatus === 'FINISHED' || gameWon) && (
        <div
          data-testid="personal-summary-panel"
          className="p-6 sm:p-8 rounded-3xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-xl max-w-2xl mx-auto space-y-6 text-center my-6"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B8F044]/20 border border-[#B8F044]/50 text-[#142B3D] dark:text-[#B8F044] text-[11px] font-mono font-bold uppercase tracking-widest">
              <Trophy className="w-3.5 h-3.5" />
              <span>{gameWon ? 'DESAFIO CONCLUÍDO' : remainingSeconds <= 0 ? 'TEMPO ESGOTADO' : 'PARTIDA CONCLUÍDA'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#142B3D] dark:text-[#F1F5F9] tracking-tight">
              {gameWon
                ? 'Desafio Concluído com Sucesso!'
                : remainingSeconds <= 0
                ? 'Tempo Limite Encerrado (05:00)'
                : 'Resumo Oficial da Partida'}
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#A8BAC8]">
              {currentInfo.title} • Duração total: {formatTime(usedDurationSeconds || Math.max(1, plannedSeconds - remainingSeconds))}
            </p>
          </div>

          {/* Métricas Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-4 rounded-2xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653]">
              <div className="text-[10px] font-mono uppercase text-[#475569] dark:text-[#A8BAC8]">Pontuação</div>
              <div data-testid="personal-score-value" className="text-2xl font-black font-mono text-[#2563EB] dark:text-[#B8F044] mt-1">
                {score}
              </div>
              <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-0.5 font-mono">pontos oficiais</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653]">
              <div className="text-[10px] font-mono uppercase text-[#475569] dark:text-[#A8BAC8]">Golpes / Acertos</div>
              <div data-testid="personal-shots-count" className="text-2xl font-black font-mono text-[#142B3D] dark:text-[#F1F5F9] mt-1">
                {shotsCount}
              </div>
              <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-0.5 font-mono">{hitsCount} acertos ({accuracyRate}%)</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653]">
              <div className="text-[10px] font-mono uppercase text-[#475569] dark:text-[#A8BAC8]">Tempo de Jogo</div>
              <div className="text-2xl font-black font-mono text-[#142B3D] dark:text-[#F1F5F9] mt-1">
                {formatTime(usedDurationSeconds || Math.max(1, plannedSeconds - remainingSeconds))}
              </div>
              <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-0.5 font-mono">de 05:00 planejados</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653]">
              <div className="text-[10px] font-mono uppercase text-[#475569] dark:text-[#A8BAC8]">Estimativa XP</div>
              <div className="text-2xl font-black font-mono text-[#2563EB] dark:text-[#60A5FA] mt-1">
                +{isGuest ? 0 : Math.max(0, Math.round(score / 2))} XP
              </div>
              <div className="text-[10px] text-[#475569] dark:text-[#A8BAC8] mt-0.5 font-mono">
                {isGuest ? 'visitante' : 'carreira atleta'}
              </div>
            </div>
          </div>

          {/* Status Discreto e Fidedigno de Sincronização */}
          <div className="p-3.5 rounded-2xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653] text-xs font-mono flex items-center justify-center gap-2">
            {isWebDemo ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  Partida demonstrativa em memória: resultados recreativos não são salvos.
                </span>
              </>
            ) : isGuest ? (
              <>
                <Sparkles className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                <span className="text-[#2563EB] dark:text-[#60A5FA]">
                  Sessão temporária de visitante: pontuação não gravada na nuvem.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#2563EB] dark:text-[#B8F044] shrink-0" />
                <span className="text-[#475569] dark:text-[#A8BAC8]">
                  Partida salva com sucesso • <b className="text-[#2563EB] dark:text-[#B8F044]">Sincronizando com a nuvem</b>
                </span>
              </>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              data-testid="btn-play-again"
              onClick={() => handleStartMatch(true)}
              disabled={startingMatch}
              className="px-6 py-3.5 rounded-xl btn-sport-lime font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <RotateCcw size={16} />
              <span>JOGAR NOVAMENTE</span>
            </button>

            {!isGuest && (
              <Link
                to="/app/history"
                className="px-5 py-3.5 rounded-xl btn-sport-outline text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <History size={16} />
                <span>HISTÓRICO</span>
              </Link>
            )}

            <button
              data-testid="btn-back-lobby"
              onClick={() => {
                prepareIdleGame(mode, plannedSeconds);
                setMatchStatus('IDLE');
              }}
              className="px-5 py-3.5 rounded-xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653] text-[#475569] dark:text-[#A8BAC8] hover:text-[#142B3D] dark:hover:text-[#F1F5F9] font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
            >
              <span>VOLTAR AO LOBBY</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 1 — TELA JOGAR CLEAN (LOBBY PRÉ-JOGO QUANDO matchStatus === 'IDLE')  */}
      {/* ========================================================================= */}
      {matchStatus === 'IDLE' && (
        <div className="space-y-4">
          {/* BANNER DE DEMONSTRAÇÃO WEB */}
          {isWebDemo && (
            <div
              data-testid="web-demo-discreet-badge"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-700 dark:text-amber-400 font-bold"
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Partida demonstrativa — resultados não são salvos</span>
              </div>
              <span className="text-[11px] font-normal text-amber-600/80 dark:text-amber-400/80">
                Simulação recreativa no navegador com o mouse
              </span>
            </div>
          )}

          {/* BANNER DE VISITANTE */}
          {isGuest && (
            <div
              data-testid="guest-play-banner"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-blue-100 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-500/40 text-xs font-mono"
            >
              <div className="flex items-center space-x-2 text-[#2563EB] dark:text-[#60A5FA] font-bold">
                <Sparkles className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                <span>MODO VISITANTE ATIVO • Resultados temporários na sessão atual</span>
              </div>
              <button
                onClick={handleExitGuestToLogin}
                className="text-[#2563EB] dark:text-[#60A5FA] hover:underline font-bold self-start sm:self-center"
              >
                Sair do Modo Visitante e Entrar com Minha Conta
              </button>
            </div>
          )}

          {/* SELEÇÃO LIMPA DE MODOS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-sm">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                data-testid="mode-btn-free"
                onClick={() => handleModeChange('free')}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 ${
                  mode === 'free'
                    ? 'bg-[#B8F044] text-[#101820] shadow-sm font-black'
                    : 'bg-[#E8EDF1] dark:bg-[#18242E] text-[#475569] dark:text-[#A8BAC8] border border-[#B8C6D0] dark:border-[#344653] hover:text-[#142B3D] dark:hover:text-[#F1F5F9]'
                }`}
              >
                <Play className="w-4 h-4" />
                <span>1. Treino Livre</span>
              </button>

              <button
                data-testid="mode-btn-single"
                onClick={() => handleModeChange('single')}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 ${
                  mode === 'single'
                    ? 'bg-[#B8F044] text-[#101820] shadow-sm font-black'
                    : 'bg-[#E8EDF1] dark:bg-[#18242E] text-[#475569] dark:text-[#A8BAC8] border border-[#B8C6D0] dark:border-[#344653] hover:text-[#142B3D] dark:hover:text-[#F1F5F9]'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>2. Liga um por vez</span>
              </button>

              <button
                data-testid="mode-btn-clear_all"
                onClick={() => handleModeChange('clear_all')}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 ${
                  mode === 'clear_all'
                    ? 'bg-[#B8F044] text-[#101820] shadow-sm font-black'
                    : 'bg-[#E8EDF1] dark:bg-[#18242E] text-[#475569] dark:text-[#A8BAC8] border border-[#B8C6D0] dark:border-[#344653] hover:text-[#142B3D] dark:hover:text-[#F1F5F9]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>3. Apagar todos</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-[#475569] dark:text-[#A8BAC8]">Parede:</span>
              <span
                data-testid="active-wall-badge"
                className="bg-[#E8EDF1] dark:bg-[#18242E] text-[#142B3D] dark:text-[#B8F044] px-3 py-1 rounded-lg border border-[#B8C6D0] dark:border-[#344653] font-bold"
              >
                {wallConfig.label || `${wallConfig.width}m × ${wallConfig.height}m`}
              </span>
            </div>
          </div>

          {/* HERO PLAY CARD: RESUMO CURTO + BOTÃO JOGAR EM GRANDE DESTAQUE */}
          <div className="p-6 rounded-3xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-[#2563EB] dark:text-[#B8F044] uppercase tracking-widest font-bold">
                  {currentInfo.title} • {currentInfo.subtitle}
                </div>
                <div
                  data-testid="personal-timer-display"
                  className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-[#142B3D] dark:text-[#F1F5F9]"
                >
                  TEMPO: {formatTime(remainingSeconds)}
                </div>
                <p className="text-xs text-[#475569] dark:text-[#A8BAC8] max-w-xl leading-relaxed">
                  {currentInfo.description}
                </p>
              </div>

              {/* AÇÃO PRINCIPAL: BOTÃO JOGAR */}
              <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-end">
                <button
                  data-testid="btn-play-start"
                  onClick={() => handleStartMatch(false)}
                  disabled={startingMatch}
                  className="flex-1 sm:flex-initial py-4 px-10 rounded-2xl btn-sport-lime font-black text-base uppercase tracking-wider transition-all flex items-center justify-center space-x-3 shadow-md disabled:opacity-60 transform active:scale-95"
                >
                  <Play size={20} className="fill-current" />
                  <span>{startingMatch ? 'PREPARANDO...' : 'JOGAR'}</span>
                </button>

                <button
                  onClick={toggleSound}
                  title={soundOn ? 'Desativar som' : 'Ativar som'}
                  className="p-3.5 rounded-2xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653] text-[#475569] dark:text-[#A8BAC8] hover:text-[#142B3D] dark:hover:text-[#F1F5F9] transition-all"
                >
                  {soundOn ? <Volume2 size={20} className="text-[#2563EB] dark:text-[#B8F044]" /> : <VolumeX size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* PAINEL RECOLHÍVEL: DIMENSÕES DA PAREDE E DIAGNÓSTICO IoT */}
          {!isWebDemo && !isGuest && (wallConfig.canConfigureWall || user?.role === 'admin') && (
            <div className="rounded-2xl bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] overflow-hidden transition-all shadow-sm">
              <button
                type="button"
                onClick={() => setShowWallAccordion((v) => !v)}
                className="w-full p-4 flex items-center justify-between text-left text-xs font-mono font-bold text-[#475569] dark:text-[#A8BAC8] hover:text-[#142B3D] dark:hover:text-[#F1F5F9] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-[#2563EB] dark:text-[#B8F044]" />
                  <span className="text-[#142B3D] dark:text-[#F1F5F9]">Configurações da Parede & Diagnóstico IoT</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#E8EDF1] dark:bg-[#18242E] text-[#2563EB] dark:text-[#B8F044] font-bold border border-[#B8C6D0] dark:border-[#344653]">
                    {wallConfig.width}m × {wallConfig.height}m
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-[#2563EB] dark:text-[#B8F044]">
                  <span className="text-[11px]">{showWallAccordion ? 'Recolher' : 'Expandir'}</span>
                  {showWallAccordion ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {showWallAccordion && (
                <div className="p-4 pt-0 space-y-4 border-t border-[#B8C6D0] dark:border-[#344653]">
                  <div
                    data-testid="nicolas-wall-selector-panel"
                    className="p-4 rounded-xl bg-[#E8EDF1] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653] space-y-3 mt-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-[#142B3D] dark:text-[#F1F5F9]">
                        Tamanho Físico da Parede (Conta: Nicolas)
                      </span>
                      <span className="text-[11px] font-mono text-[#475569] dark:text-[#A8BAC8]">
                        Selecione a dimensão antes de clicar em JOGAR
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {NICOLAS_WALL_OPTIONS.map((opt) => {
                        const optW = opt.widthM || opt.width;
                        const optH = opt.heightM || opt.height;
                        const isSelected =
                          wallConfig.preset === opt.key ||
                          (Number(wallConfig.width) === optW && Number(wallConfig.height) === optH);

                        return (
                          <button
                            key={opt.key}
                            data-testid={`wall-option-${opt.key}`}
                            onClick={() => handleSelectNicolasWallPreset(opt.key)}
                            disabled={savingWall}
                            className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#F4F6F8] dark:bg-[#22313D] border-[#B8F044] shadow-sm'
                                : 'bg-[#E8EDF1] dark:bg-[#18242E] border-[#B8C6D0] dark:border-[#344653] hover:border-[#B8F044]'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-black uppercase text-[#142B3D] dark:text-[#F1F5F9]">{opt.label}</span>
                              {isSelected && (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#B8F044] text-[#101820]">
                                  ATIVA
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-baseline justify-between font-mono">
                              <span className="text-base font-black text-[#2563EB] dark:text-[#B8F044]">
                                {optW}m × {optH}m
                              </span>
                              <span className="text-[10px] text-[#475569] dark:text-[#A8BAC8]">
                                S1(0,{optH}) • S2({optW},{optH}) • S3(0,0)
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {wallFeedback && (
                      <div
                        data-testid="wall-config-feedback"
                        className={`text-xs font-mono px-3 py-2 rounded-xl border flex items-center gap-2 ${
                          wallFeedback.ok
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200'
                            : 'bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-600 text-rose-800 dark:text-rose-200'
                        }`}
                      >
                        {wallFeedback.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <span>{wallFeedback.text}</span>
                      </div>
                    )}
                  </div>

                  {/* Botão Diagnóstico IoT */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      data-testid="btn-toggle-iot-panel"
                      onClick={() => setShowIotPanel((v) => !v)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                        showIotPanel
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-[#08130C] border-[#1B3624] text-cyan-400 hover:border-cyan-400/50'
                      }`}
                    >
                      <Radio size={14} />
                      <span>{showIotPanel ? 'Ocultar Diagnóstico IoT' : 'Abrir Diagnóstico IoT'}</span>
                    </button>

                    {user?.role === 'admin' && (
                      <Link
                        to="/admin/equipments"
                        className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 underline underline-offset-2"
                      >
                        <Settings size={14} />
                        <span>Configurações Avançadas de Equipamento</span>
                      </Link>
                    )}
                  </div>

                  {showIotPanel && (
                    <IotDiagnosticPanel wallConfig={wallConfig} onClose={() => setShowIotPanel(false)} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* PRÉ-VISUALIZAÇÃO DA PAREDE EM MODO PRÉ-JOGO */}
          <div className="w-full flex justify-center py-2 relative">
            <div className="w-full relative flex justify-center">
              <CourtTarget
                gameMode={mode}
                activeSectorId={activeSectorId}
                activeTargetId={activeSectorId}
                sectorStates={sectorStates}
                targetStates={sectorStates}
                lastHitSectorId={lastHitSectorId}
                lastHitTargetId={lastHitSectorId}
                lastImpactCoords={lastImpactCoords}
                onSectorHit={handleWallSectorHit}
                onTargetHit={handleWallSectorHit}
                interactive={false}
                wallPreset={wallConfig.preset}
                sensorOffsetsCm={wallConfig.sensorOffsetsCm}
                isFullscreen={false}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
