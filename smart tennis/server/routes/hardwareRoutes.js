const express = require('express');
const router = express.Router();
const { generateSimulatedSensorHit } = require('../services/gameEngine');
const { broadcastEvent } = require('../services/eventHub');
const { requireAuth, requireUserOrGuest } = require('../services/authService');
const experienceService = require('../services/experienceService');
const personalMatchService = require('../services/personalMatchService');
const iotLocalizationService = require('../services/iotLocalizationService');
const arduinoIngestService = require('../services/arduinoIngestService');

let hardwareStatus = {
  mode: 'simulation',
  lastSeen: null,
  activeSensors: ['S1', 'S2', 'S3'],
  baudRate: 115200,
  port: 'COM3 (Virtual)'
};

async function requireNicolasOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  const isAdmin = req.user.role === 'admin';
  const isNicolas = await iotLocalizationService.isNicolasAccount(req.user.id);
  if (!isAdmin && !isNicolas) {
    return res.status(403).json({
      error: 'Acesso restrito. O painel técnico de diagnóstico IoT é exclusivo para usuários autorizados.'
    });
  }
  return next();
}

// GET /api/hardware/status
router.get('/status', (req, res) => {
  res.json({
    status: hardwareStatus.mode === 'connected' ? 'connected' : 'simulation',
    details: hardwareStatus
  });
});

// POST /api/hardware/mode
router.post('/mode', (req, res) => {
  const { mode, port, baudRate } = req.body || {};
  if (mode === 'simulation' || mode === 'connected') {
    hardwareStatus.mode = mode;
    if (port) hardwareStatus.port = port;
    if (baudRate) hardwareStatus.baudRate = Number(baudRate);
    hardwareStatus.lastSeen = new Date().toISOString();
    arduinoIngestService.setHardwareConnectionMode(mode, { port, baudRate });
    broadcastEvent('HARDWARE_STATUS_CHANGED', hardwareStatus);
    return res.json({ success: true, hardwareStatus });
  }
  res.status(400).json({ error: 'Modo inválido. Use "simulation" ou "connected"' });
});

// ============================================================================
// INTEGRAÇÃO ARDUINO E PAINEL DE DIAGNÓSTICO IoT (SEÇÕES 5, 6 E 7)
// ============================================================================

// POST /api/hardware/arduino/events e /api/hardware/arduino/reading
async function handleArduinoEvents(req, res) {
  try {
    const result = await arduinoIngestService.ingestArduinoPayload(req.body || {});
    hardwareStatus.lastSeen = new Date().toISOString();

    const httpCode = result.accepted ? 200 : (
      result.status === 'REJECTED_DUPLICATE_EVENT' || result.duplicateSensorInGroup ? 409 : 422
    );

    return res.status(httpCode).json({
      success: Boolean(result.accepted),
      ...result
    });
  } catch (error) {
    console.error('[ARDUINO INGEST] Erro ao processar leitura do Arduino:', error);
    return res.status(500).json({ error: error.message });
  }
}

router.post('/arduino/events', handleArduinoEvents);
router.post('/arduino/reading', handleArduinoEvents);
router.post('/arduino-events', handleArduinoEvents);
router.post('/arduino-event', handleArduinoEvents);

// GET /api/hardware/iot-diagnostics - Restrito a Nicolas ou Admin (bloqueia visitantes e terceiros)
router.get('/iot-diagnostics', requireAuth, requireNicolasOrAdmin, async (req, res) => {
  try {
    const diag = await arduinoIngestService.getIotDiagnosticsState(req.actor);
    res.json(diag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT / POST /api/hardware/iot-calibration - Atualiza calibração experimental e/ou offsets dos sensores
async function handleUpdateIotCalibration(req, res) {
  try {
    const { calibration, sensorOffsetsCm, preset } = req.body || {};
    const updated = await iotLocalizationService.updateNicolasWallConfig({
      actor: req.actor,
      preset,
      sensorOffsetsCm,
      calibration
    });
    const diag = await arduinoIngestService.getIotDiagnosticsState(req.actor);
    broadcastEvent('IOT_DIAGNOSTIC_UPDATED', diag);
    res.json({
      success: true,
      wallConfig: updated,
      diagnostics: diag
    });
  } catch (error) {
    if (error instanceof iotLocalizationService.WallConfigHttpError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        ...error.extra
      });
    }
    res.status(500).json({ error: error.message });
  }
}

router.put('/iot-calibration', requireAuth, requireNicolasOrAdmin, handleUpdateIotCalibration);
router.post('/iot-calibration', requireAuth, requireNicolasOrAdmin, handleUpdateIotCalibration);

// POST /api/hardware/iot-diagnostics/test-tdoa - Teste técnico de eventos sintéticos no painel de diagnóstico
router.post('/iot-diagnostics/test-tdoa', requireAuth, requireNicolasOrAdmin, async (req, res) => {
  try {
    const {
      xMeters,
      yMeters,
      t1Us,
      t2Us,
      t3Us,
      eventId,
      deviceId = 'ARDUINO_TEST_BENCH'
    } = req.body || {};

    const wallCfg = await iotLocalizationService.getWallConfigForActor(req.actor);
    let payloadToIngest;

    if (t1Us !== undefined || t2Us !== undefined || t3Us !== undefined) {
      payloadToIngest = {
        event_id: eventId || `bench_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        device_id: deviceId,
        t1_us: t1Us,
        t2_us: t2Us,
        t3_us: t3Us,
        valid: true
      };
    } else {
      const targetX = xMeters !== undefined ? Number(xMeters) : Number((wallCfg.widthM / 2).toFixed(2));
      const targetY = yMeters !== undefined ? Number(yMeters) : Number((wallCfg.heightM / 2).toFixed(2));
      const speed = Number(wallCfg.calibration?.propagationSpeedMps || 340);

      const synth = iotLocalizationService.generateSyntheticArduinoTimestamps({
        xMeters: targetX,
        yMeters: targetY,
        presetOrDims: { width: wallCfg.widthM, height: wallCfg.heightM },
        sensorOffsetsCm: wallCfg.sensorOffsetsCm,
        propagationSpeedMps: speed,
        baseTimestampUs: 1000000 + Math.floor(Math.random() * 500000),
        sensorDelayOffsetsUs: wallCfg.calibration?.sensorDelayOffsetsUs
      });

      const baseEvt = eventId || `synth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      payloadToIngest = {
        readings: [
          { event_id: `${baseEvt}_S1`, sensor_id: 'S1', timestamp_us: synth.t1Us, device_id: deviceId, valid: true },
          { event_id: `${baseEvt}_S2`, sensor_id: 'S2', timestamp_us: synth.t2Us, device_id: deviceId, valid: true },
          { event_id: `${baseEvt}_S3`, sensor_id: 'S3', timestamp_us: synth.t3Us, device_id: deviceId, valid: true }
        ],
        finalize_pending: true
      };
    }

    const ingestResult = await arduinoIngestService.ingestArduinoPayload(payloadToIngest, req.actor);
    const diagnostics = await arduinoIngestService.getIotDiagnosticsState(req.actor);

    res.json({
      success: Boolean(ingestResult.accepted),
      ingestResult,
      diagnostics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ROTAS DE JOGO E SIMULAÇÃO POR MOUSE (PRESERVADAS INTEGRALMENTE)
// ============================================================================

// POST /api/hardware/hit - Exige sessão válida de usuário ou visitante (requireUserOrGuest)
router.post('/hit', requireUserOrGuest, async (req, res) => {
  try {
    const {
      sensor_id,
      sector_id,
      target_id,
      speed,
      force,
      x,
      y,
      equipment_id = 1,
      session_id,
      match_id,
      game_mode = 'free',
      source = 'mouse',
      is_simulation = true,
      client_event_id
    } = req.body || {};

    const resolvedId = sector_id !== undefined ? sector_id : (target_id !== undefined ? target_id : sensor_id);

    if (resolvedId === undefined && x === undefined && y === undefined) {
      return res.status(400).json({
        error: 'Informe setor_id (1 a 6) ou coordenadas X e Y.',
        expected: {
          sector_id: 'Setor de 1 a 6',
          x: 'Coordenada X (0 a 100)',
          y: 'Coordenada Y (0 a 100)',
          game_mode: 'free | single | clear_all'
        }
      });
    }

    hardwareStatus.lastSeen = new Date().toISOString();

    // MODO SHOPPING: impactos pertencem à experiência comercial ativa
    const installation = await experienceService.getInstallation();
    if (installation.mode === 'shopping') {
      try {
        const out = await experienceService.registerHardwareImpact({
          x, y, sectorId: resolvedId, clientEventId: client_event_id
        });
        return res.status(out.accepted ? 201 : 200).json({
          success: out.accepted,
          shopping: true,
          received_by_backend: true,
          persisted_in_db: !out.state?.isGuest,
          data: out
        });
      } catch (err) {
        if (err instanceof experienceService.HttpError) return res.status(err.status).json({ error: err.message });
        throw err;
      }
    }

    // MODO PESSOAL: processa através do serviço oficial de partidas pessoais (5s PREPARING + 5min ACTIVE, isolando visitante)
    let result;
    try {
      result = await personalMatchService.registerPersonalImpact({
        actor: req.actor,
        equipmentId: equipment_id,
        matchId: match_id || null,
        sessionId: session_id || null,
        gameMode: game_mode,
        sectorId: resolvedId,
        x,
        y,
        speed: speed !== undefined ? speed : (force !== undefined ? force : 80),
        source,
        isSimulation: Boolean(is_simulation),
        clientEventId: client_event_id || null
      });
    } catch (err) {
      if (err instanceof personalMatchService.PersonalMatchHttpError) {
        return res.status(err.status).json({
          success: false,
          error: err.message,
          ...err.extra
        });
      }
      throw err;
    }

    const broadcastPayload = {
      ...result,
      source,
      is_simulation,
      client_event_id,
      hit_id: result.hit ? result.hit.id : result.hit_id || null,
      shot_id: result.hit ? result.hit.shot_id : result.shot_id || null,
      received_by_backend: true,
      persisted_in_db: Boolean(result.persisted_in_db)
    };

    if (!result.duplicate && !result.is_guest) {
      broadcastEvent('HIT_REGISTERED', broadcastPayload);
      broadcastEvent('SHOT_REGISTERED', {
        shot: result.hit,
        player: result.player,
        attributeUpdates: result.attributeUpdates,
        unlockedAchievements: result.unlockedAchievements
      });

      if (result.player && result.player.leveledUp) {
        broadcastEvent('LEVEL_UP', result.player);
      }
      if (result.unlockedAchievements && result.unlockedAchievements.length > 0) {
        broadcastEvent('ACHIEVEMENT_UNLOCKED', result.unlockedAchievements);
      }
    }

    res.status(201).json({
      success: true,
      received_by_backend: true,
      persisted_in_db: Boolean(result.persisted_in_db),
      is_guest: Boolean(result.is_guest),
      hit_id: broadcastPayload.hit_id,
      shot_id: broadcastPayload.shot_id,
      duplicate: Boolean(result.duplicate),
      message: result.is_guest
        ? 'Impacto computado na sessão temporária de visitante.'
        : 'Impacto computado e persistido no SQLite com sucesso.',
      data: broadcastPayload
    });
  } catch (error) {
    console.error('[HW] Erro ao registrar impacto no hardware:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/hardware/simulate - Simulation endpoint adapted for the 6 fixed targets
router.post('/simulate', requireUserOrGuest, async (req, res) => {
  try {
    const { target_sensor_id, target_id, game_mode = 'free', active_sensors, active_targets, equipment_id = 1, session_id, match_id, client_event_id } = req.body || {};
    const chosenTarget = target_id !== undefined ? target_id : target_sensor_id;
    const available = active_targets !== undefined ? active_targets : active_sensors;

    const sim = generateSimulatedSensorHit(chosenTarget, available);

    const installation = await experienceService.getInstallation();
    if (installation.mode === 'shopping') {
      try {
        const out = await experienceService.registerHardwareImpact({
          x: sim.x,
          y: sim.y,
          sectorId: sim.target_id,
          clientEventId: client_event_id
        });
        return res.status(out.accepted ? 201 : 200).json({ success: out.accepted, shopping: true, data: out });
      } catch (err) {
        if (err instanceof experienceService.HttpError) return res.status(err.status).json({ error: err.message });
        throw err;
      }
    }

    const result = await personalMatchService.registerPersonalImpact({
      actor: req.actor,
      equipmentId: equipment_id,
      matchId: match_id || null,
      sessionId: session_id || null,
      gameMode: game_mode,
      sectorId: sim.target_id,
      x: sim.x,
      y: sim.y,
      speed: sim.speed,
      source: 'simulation',
      isSimulation: true,
      clientEventId: client_event_id || null
    });

    res.json(result);
  } catch (error) {
    if (error instanceof personalMatchService.PersonalMatchHttpError) {
      return res.status(error.status).json({ success: false, error: error.message, ...error.extra });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
