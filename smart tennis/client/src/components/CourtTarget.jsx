import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  WALL_PRESETS,
  NICOLAS_WALL_OPTIONS,
  PHYSICAL_CONSTANTS,
  calculateSensorPositions,
  calculateWallGeometry,
  classifyImpact,
  FIXED_SECTORS,
  FIXED_TARGETS,
  FIXED_SENSORS
} from '../services/wallGeometry';

export {
  WALL_PRESETS,
  NICOLAS_WALL_OPTIONS,
  PHYSICAL_CONSTANTS,
  calculateSensorPositions,
  calculateWallGeometry,
  classifyImpact,
  FIXED_SECTORS,
  FIXED_TARGETS,
  FIXED_SENSORS
};

// Aliases de compatibilidade
export const DETECTION_RADIUS = 30.0;
export const VISUAL_RADIUS = 20.0;
export const detectSector = (x, y, preset = '3x2') => classifyImpact(x, y, preset);
export const detectNearestTarget = detectSector;

export default function CourtTarget({
  gameMode = 'free', // 'free', 'single', 'clear_all'
  activeTargetId = null,
  activeSectorId = null,
  targetStates = {},
  sectorStates = {},
  lastHitTargetId = null,
  lastHitSectorId = null,
  lastImpactCoords = null,
  onTargetHit,
  onSectorHit,
  interactive = true,
  debugMode = false,
  wallPreset = '3x2',
  sensorOffsetsCm = null,
  showSensors = true,
  isFullscreen = false
}) {
  const containerRef = useRef(null);
  const [impactEffects, setImpactEffects] = useState([]);
  const [hitPulses, setHitPulses] = useState({}); // { [sectorId]: timestamp }

  // Geometria dinâmica proporcional às dimensões físicas da parede (4x3m, 3x3m, 3x2m)
  const geometry = useMemo(
    () => calculateWallGeometry(wallPreset, sensorOffsetsCm || {}),
    [wallPreset, sensorOffsetsCm]
  );

  const effectiveActiveSectorId = activeSectorId || activeTargetId;
  const effectiveSectorStates = Object.keys(sectorStates).length > 0 ? sectorStates : targetStates;
  const effectiveLastHitId = lastHitSectorId || lastHitTargetId;

  // Efeito de pulso rápido no setor atingido
  useEffect(() => {
    if (effectiveLastHitId) {
      setHitPulses((prev) => ({ ...prev, [effectiveLastHitId]: Date.now() }));
      const timer = setTimeout(() => {
        setHitPulses((prev) => {
          const next = { ...prev };
          delete next[effectiveLastHitId];
          return next;
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [effectiveLastHitId]);

  // Efeito de onda de impacto no ponto exato do clique
  useEffect(() => {
    if (lastImpactCoords && lastImpactCoords.x !== undefined && lastImpactCoords.y !== undefined) {
      const effectId = Date.now() + Math.random();
      const newEffect = {
        id: effectId,
        x: lastImpactCoords.x,
        y: lastImpactCoords.y,
        hit: lastImpactCoords.hit !== false
      };
      setImpactEffects((prev) => [...prev.slice(-4), newEffect]);
      const timer = setTimeout(() => {
        setImpactEffects((prev) => prev.filter((e) => e.id !== effectId));
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [lastImpactCoords]);

  // Processa o clique no contêiner da parede e classifica geometricamente
  const handleWallClick = (e) => {
    if (!interactive || !containerRef.current) return;
    const notifyFn = onSectorHit || onTargetHit;
    if (!notifyFn) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const clickX = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const clickY = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    // Classificação geométrica unificada (Alvo Válido vs Espaçamento/Margem vs Fora)
    const result = classifyImpact(clickX, clickY, wallPreset);

    if (result.classification === 'TARGET_HIT') {
      notifyFn({
        hit: true,
        sectorId: result.sectorId,
        targetId: result.sectorId,
        sensorId: result.sectorId,
        x: clickX,
        y: clickY,
        sector: result.sector,
        classification: 'TARGET_HIT'
      });
    } else {
      // Impacto no corredor entre alvos ou margem externa (Área Neutra)
      notifyFn({
        hit: false,
        sectorId: null,
        targetId: null,
        sensorId: null,
        x: clickX,
        y: clickY,
        classification: result.classification,
        reason: result.reason
      });
    }
  };

  const aspectClass = geometry.ratioClass || (
    geometry.aspectRatio === '1/1'
      ? 'aspect-square'
      : geometry.aspectRatio === '3/2'
        ? 'aspect-[3/2]'
        : 'aspect-[4/3]'
  );

  const { S1, S2, S3 } = geometry.sensors;

  return (
    <div
      className={`relative w-full mx-auto select-none flex items-center justify-center ${
        isFullscreen ? 'h-full max-h-[92vh] max-w-full' : 'max-w-5xl'
      }`}
    >
      {/* Contêiner da Parede Projeção proporcional à dimensão física selecionada */}
      <div
        ref={containerRef}
        onClick={handleWallClick}
        data-testid="smart-tennis-projection-wall"
        data-wall-preset={geometry.preset}
        data-wall-dimensions={`${geometry.widthM}x${geometry.heightM}`}
        style={{
          aspectRatio: geometry.aspectRatio,
          maxWidth: geometry.aspectRatio === '1/1' ? '760px' : undefined
        }}
        className={`relative w-full ${aspectClass} max-h-[82vh] bg-[#030905] border-4 border-[#16C96B]/50 shadow-[0_0_60px_rgba(22,201,107,0.18),inset_0_0_40px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden transition-all duration-300 ${
          interactive ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        {/* POSICIONAMENTO FÍSICO REAL DOS 3 SENSORES KY-037 NOS CANTOS DA PAREDE (SEÇÕES 3 E 4) */}
        {showSensors && (
          <>
            {/* S1: Canto Superior Esquerdo = (0, altura) */}
            <div
              data-testid="wall-sensor-S1"
              data-sensor-corner="top_left"
              data-sensor-coords={`(${S1.xM}, ${S1.yM})`}
              className="absolute top-1.5 left-1.5 z-20 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#07180F]/95 border border-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono font-black text-[10px] text-cyan-300 tracking-wider">
                S1 ({S1.xM}, {S1.yM}m)
              </span>
            </div>

            {/* S2: Canto Superior Direito = (largura, altura) */}
            <div
              data-testid="wall-sensor-S2"
              data-sensor-corner="top_right"
              data-sensor-coords={`(${S2.xM}, ${S2.yM})`}
              className="absolute top-1.5 right-1.5 z-20 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#07180F]/95 border border-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono font-black text-[10px] text-cyan-300 tracking-wider">
                S2 ({S2.xM}, {S2.yM}m)
              </span>
            </div>

            {/* S3: Canto Inferior Esquerdo = (0, 0) [Origem Cartesiana] */}
            <div
              data-testid="wall-sensor-S3"
              data-sensor-corner="bottom_left"
              data-sensor-coords={`(${S3.xM}, ${S3.yM})`}
              className="absolute bottom-1.5 left-1.5 z-20 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#07180F]/95 border border-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono font-black text-[10px] text-cyan-300 tracking-wider">
                S3 ({S3.xM}, {S3.yM}m)
              </span>
            </div>

            {/* Canto Inferior Direito NÃO possui sensor — apenas indicador discreto da dimensão da parede */}
            <div
              data-testid="wall-corner-bottom-right-empty"
              data-has-sensor="false"
              className="absolute bottom-1.5 right-2 z-10 pointer-events-none font-mono text-[9px] text-[#8C9891]/60"
            >
              {geometry.widthM}m × {geometry.heightM}m
            </div>
          </>
        )}

        {/* 6 ALVOS RETANGULARES INDEPENDENTES COM ESPAÇAMENTO FÍSICO DE 30 CM E MARGENS DE 10 CM */}
        {geometry.sectors.map((sector) => {
          const isPulse = Boolean(hitPulses[sector.id]);
          let isTarget = false;
          let isLit = false;

          let sectorBgClass = '';
          let borderStyle = '';
          let labelColor = '';
          let badgeColor = '';
          let dimColor = '';
          let statusColor = '';
          let statusText = '';

          if (isPulse) {
            sectorBgClass = 'bg-white text-[#07110B] shadow-[0_0_50px_rgba(255,255,255,1),0_0_25px_#39FF88] z-20 scale-[1.02]';
            borderStyle = 'border-4 border-white';
            labelColor = 'text-[#07110B]';
            badgeColor = 'text-[#07110B]';
            dimColor = 'text-[#07110B]';
            statusColor = 'text-[#07110B] font-black';
            statusText = '★ IMPACTO ★';
          } else if (gameMode === 'free') {
            sectorBgClass = 'bg-[#0A1F13] text-[#F5F7F5] shadow-[0_4px_24px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(22,201,107,0.08)] hover:border-[#39FF88] hover:bg-[#0F2D1C] hover:shadow-[0_0_25px_rgba(57,255,136,0.25)]';
            borderStyle = 'border-2 border-[#16C96B]';
            labelColor = 'text-[#F5F7F5]';
            badgeColor = 'text-[#39FF88]';
            dimColor = 'text-[#8C9891]';
            statusColor = 'text-[#39FF88]';
            statusText = 'LIVRE';
          } else if (gameMode === 'single') {
            isTarget = effectiveActiveSectorId === sector.id;
            if (isTarget) {
              sectorBgClass = 'bg-[#39FF88] text-[#07110B] shadow-[0_0_40px_rgba(57,255,136,0.8),inset_0_0_20px_rgba(255,255,255,0.7)] z-10 animate-pulse scale-[1.02]';
              borderStyle = 'border-4 border-white';
              labelColor = 'text-[#07110B]';
              badgeColor = 'text-[#07110B]';
              dimColor = 'text-[#07110B]';
              statusColor = 'text-[#07110B] font-black';
              statusText = '★ ACERTE AQUI ★';
            } else {
              sectorBgClass = 'bg-[#06130B] text-[#1F3E2B] shadow-[0_4px_16px_rgba(0,0,0,0.5)]';
              borderStyle = 'border-2 border-[#16C96B]/20';
              labelColor = 'text-[#1F3E2B]';
              badgeColor = 'text-[#2D5A3D]';
              dimColor = 'text-[#1F3E2B]';
              statusColor = 'text-[#2D5A3D]';
              statusText = 'AGUARDANDO';
            }
          } else if (gameMode === 'clear_all') {
            isLit = effectiveSectorStates[sector.id] !== false;
            if (isLit) {
              sectorBgClass = 'bg-[#16C96B] text-[#07110B] shadow-[0_0_30px_rgba(22,201,107,0.5),inset_0_0_15px_rgba(57,255,136,0.3)] z-10';
              borderStyle = 'border-2 border-[#39FF88]';
              labelColor = 'text-[#07110B] font-black';
              badgeColor = 'text-[#07110B]';
              dimColor = 'text-[#07110B]';
              statusColor = 'text-[#07110B] font-black';
              statusText = 'ACESO';
            } else {
              sectorBgClass = 'bg-[#050E08] text-[#1A2E22] shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]';
              borderStyle = 'border border-[#16C96B]/15';
              labelColor = 'text-[#1A2E22]';
              badgeColor = 'text-[#263D2E]';
              dimColor = 'text-[#1A2E22]';
              statusColor = 'text-[#263D2E]';
              statusText = 'APAGADO';
            }
          }

          return (
            <div
              key={sector.id}
              data-sector-id={sector.id}
              data-testid={`sector-${sector.id}`}
              style={{
                position: 'absolute',
                left: `${sector.xMin}%`,
                top: `${sector.yMin}%`,
                width: `${sector.widthPct}%`,
                height: `${sector.heightPct}%`,
                borderRadius: '14px'
              }}
              className={`flex flex-col items-center justify-center p-3 select-none transition-all duration-150 ${borderStyle} ${sectorBgClass}`}
            >
              {/* Identificação do Alvo */}
              <div className={`absolute top-2.5 left-3.5 font-mono font-bold text-[10px] sm:text-xs tracking-wider uppercase ${badgeColor}`}>
                ALVO {sector.id}
              </div>

              {/* Dimensão física em cm */}
              <div className={`absolute top-2.5 right-3.5 font-mono text-[9px] sm:text-[10px] ${dimColor}`}>
                {Math.round(sector.widthM * 100)}×{Math.round(sector.heightM * 100)}cm
              </div>

              {/* Número Grande Visível no Projetor */}
              <div
                className={`font-mono font-black text-5xl sm:text-6xl md:text-7xl leading-none transition-transform duration-100 ${
                  isLit || isTarget ? 'scale-105' : 'scale-100'
                } ${labelColor}`}
              >
                {sector.id}
              </div>

              {/* Status do Alvo */}
              <div className={`absolute bottom-2.5 font-mono font-bold text-[10px] sm:text-[11px] tracking-widest uppercase ${statusColor}`}>
                {statusText}
              </div>
            </div>
          );
        })}

        {/* Efeito de onda visual no ponto exato do golpe com mouse */}
        {impactEffects.map((eff) => (
          <div
            key={eff.id}
            style={{ left: `${eff.x}%`, top: `${eff.y}%`, transform: 'translate(-50%, -50%)' }}
            className="absolute pointer-events-none z-30 flex items-center justify-center"
          >
            {eff.hit ? (
              <>
                <div className="w-14 h-14 rounded-full border-2 border-[#39FF88] animate-ping" />
                <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_15px_#39FF88]" />
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full border-2 border-amber-400/80 animate-ping" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
