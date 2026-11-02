// SMART TENNIS — SERVIÇO DE RECEBIMENTO DE DADOS DO ARDUINO, AGRUPAMENTO TEMPORAL E DIAGNÓSTICO IoT
//
// Responsabilidades (Seções 6 e 7):
// - Receber leituras individuais ou em lote dos 3 sensores KY-037 (S1, S2, S3) conectados ao Arduino.
// - Priorizar exclusivamente os timestamps em microssegundos do relógio do microcontrolador (nunca usar Date.now() para TDOA).
// - Agrupar leituras do mesmo dispositivo dentro de uma janela temporal configurável (groupingWindowUs).
// - Tratar leituras duplicadas, leituras incompletas (sensor sem resposta), ruídos/falsos disparos,
//   impactos próximos no tempo e reinicialização do contador de microssegundos (overflow 32 bits).
// - Manter o estado para o Painel de Diagnóstico IoT distinguindo claramente:
//     1. SIMULATED_IMPACT   ("Impacto simulado")
//     2. HARDWARE_UNLOCATED ("Impacto detectado pelo hardware sem localização confiável")
//     3. HARDWARE_LOCATED   ("Impacto localizado pelo algoritmo com calibração válida")

const crypto = require('crypto');
const {
  getNicolasAccount,
  getWallConfigForActor,
  signedMicrosDiff,
  estimateImpactLocationTDOA
} = require('./iotLocalizationService');
const { broadcastEvent } = require('./eventHub');

const VALID_SENSORS = new Set(['S1', 'S2', 'S3']);
const MAX_PROCESSED_EVENT_IDS = 1000;
const MAX_DIAGNOSTIC_LOG = 30;

// Estado em memória do subsistema de hardware e diagnóstico IoT
let connectionState = {
  mode: 'simulation', // 'simulation' | 'connected'
  port: 'COM3 (Aguardando Arduino / Ponte Serial)',
  baudRate: 115200,
  lastArduinoPacketAt: null,
  lastDeviceId: null
};

// Conjunto limitado de event_ids já processados para rejeição de eventos duplicados
const processedEventIds = new Set();
const processedEventQueue = [];

// Agrupamentos pendentes por device_id: { [deviceId]: { groupId, deviceId, firstTimestampUs, createdAtMs, readings: { S1, S2, S3 }, rawEvents: [] } }
const pendingGroupsByDevice = new Map();

// Último impacto completo por device_id (para controle de eco/refratário entre impactos muito próximos)
const lastCompletedImpactByDevice = new Map();

// Último estado consolidado do diagnóstico IoT (eventos reais/sintéticos de protocolo Arduino)
let lastHardwareDiagnostic = null;

// Último impacto simulado por mouse/interface (mantido separado para nunca ser confundido com Arduino)
let lastSimulatedDiagnostic = null;

// Histórico recente de eventos de diagnóstico
const diagnosticHistory = [];

function normalizeSensorId(rawSensorId) {
  if (rawSensorId === undefined || rawSensorId === null) return null;
  const s = String(rawSensorId).trim().toUpperCase();
  if (s === 'S1' || s === '1' || s === 'SENSOR_1' || s === 'SENSOR-1') return 'S1';
  if (s === 'S2' || s === '2' || s === 'SENSOR_2' || s === 'SENSOR-2') return 'S2';
  if (s === 'S3' || s === '3' || s === 'SENSOR_3' || s === 'SENSOR-3') return 'S3';
  return null;
}

function rememberEventId(eventId) {
  if (!eventId) return;
  const key = String(eventId).trim();
  if (!key) return;
  processedEventIds.add(key);
  processedEventQueue.push(key);
  if (processedEventQueue.length > MAX_PROCESSED_EVENT_IDS) {
    const oldest = processedEventQueue.shift();
    processedEventIds.delete(oldest);
  }
}

function pushDiagnosticHistory(entry) {
  diagnosticHistory.unshift(entry);
  if (diagnosticHistory.length > MAX_DIAGNOSTIC_LOG) {
    diagnosticHistory.pop();
  }
}

/**
 * Registra um impacto simulado (ex.: clique de mouse no jogo) APENAS como referência
 * de simulação, sem jamais apresentá-lo como evento vindo do Arduino.
 */
function recordSimulatedImpactDiagnostic({ xPct, yPct, sectorId, classification, gameMode, wallPreset }) {
  lastSimulatedDiagnostic = {
    category: 'SIMULATED_IMPACT',
    categoryLabel: '1. Impacto simulado',
    source: 'mouse_simulation',
    isArduinoHardware: false,
    receivedAt: new Date().toISOString(),
    xScreenPct: xPct ?? null,
    yScreenPct: yPct ?? null,
    sectorId: sectorId ?? null,
    classification: classification || 'SIMULATED',
    gameMode: gameMode || 'free',
    wallPreset: wallPreset || '3x2'
  };
  return lastSimulatedDiagnostic;
}

/**
 * Finaliza um grupo pendente (seja por estar completo 3/3 ou por ter expirado incompleto 1/3 ou 2/3)
 */
function finalizeGroup(group, reason, wallCfg) {
  const s1Reading = group.readings.S1 || null;
  const s2Reading = group.readings.S2 || null;
  const s3Reading = group.readings.S3 || null;

  const t1Us = s1Reading ? s1Reading.timestampUs : null;
  const t2Us = s2Reading ? s2Reading.timestampUs : null;
  const t3Us = s3Reading ? s3Reading.timestampUs : null;

  const presentSensors = ['S1', 'S2', 'S3'].filter((k) => Boolean(group.readings[k]));
  const missingSensors = ['S1', 'S2', 'S3'].filter((k) => !group.readings[k]);
  const isComplete = presentSensors.length === 3;

  // Se apenas 1 sensor disparou isoladamente e expirou a janela -> classificar como ruído/falso disparo ou leitura incompleta
  const isSingleSpikeNoise = !isComplete && presentSensors.length === 1 && reason === 'WINDOW_EXPIRED_INCOMPLETE';

  const tdoa = estimateImpactLocationTDOA({
    t1Us,
    t2Us,
    t3Us,
    presetOrDims: { width: wallCfg.widthM, height: wallCfg.heightM },
    sensorOffsetsCm: wallCfg.sensorOffsetsCm,
    calibration: wallCfg.calibration
  });

  const isSimulatedDevice = Boolean(
    group.isSimulation ||
    (group.deviceId && String(group.deviceId).toUpperCase().includes('SIMULAT'))
  );

  let category = 'HARDWARE_UNLOCATED';
  let categoryLabel = isSimulatedDevice
    ? '2. Impacto sintético sem localização confiável (Simulação)'
    : '2. Impacto detectado pelo hardware sem localização confiável';
  let groupingState = isComplete ? 'COMPLETE_3_OF_3' : 'INCOMPLETE';
  let groupingLabel = isComplete
    ? 'Agrupamento completo (S1, S2 e S3 dentro da janela temporal)'
    : `Leitura incompleta (${presentSensors.length}/3 sensores — ausente: ${missingSensors.join(', ')})`;

  if (isSingleSpikeNoise) {
    groupingState = 'NOISE_OR_INCOMPLETE';
    groupingLabel = `Disparo isolado em ${presentSensors[0]} sem confirmação de ${missingSensors.join(' e ')} (ruído ou leitura incompleta)`;
  }

  if (isComplete && tdoa.status === 'valid' && tdoa.locationReliable) {
    category = isSimulatedDevice ? 'SIMULATED_TDOA_LOCATED' : 'HARDWARE_LOCATED';
    categoryLabel = isSimulatedDevice
      ? '3. Impacto sintético localizado pelo algoritmo (Simulação)'
      : '3. Impacto localizado pelo algoritmo com calibração válida';
  }

  const record = {
    groupId: group.groupId,
    eventId: group.lastEventId || group.groupId,
    deviceId: group.deviceId,
    receivedAt: new Date().toISOString(),
    isArduinoHardware: !isSimulatedDevice,
    isSimulation: isSimulatedDevice,
    category,
    categoryLabel,
    groupingState,
    groupingLabel,
    finalizeReason: reason,
    presentSensors,
    missingSensors,
    duplicateSensorTriggersIgnored: group.duplicateSensorTriggers || 0,
    wallPreset: wallCfg.preset,
    wallWidthM: wallCfg.widthM,
    wallHeightM: wallCfg.heightM,
    sensors: wallCfg.sensors,
    t1Us,
    t2Us,
    t3Us,
    dt21Us: tdoa.dt21Us,
    dt31Us: tdoa.dt31Us,
    dt32Us: tdoa.dt32Us,
    estimationStatus: tdoa.status, // 'valid' | 'uncertain' | 'unavailable'
    estimationStatusLabel: tdoa.classificationLabel, // 'válida' | 'incerta' | 'indisponível'
    estimationReason: isComplete ? tdoa.reason : 'INCOMPLETE_READINGS',
    estimationMessage: isComplete
      ? tdoa.message
      : `Leitura incompleta (${presentSensors.length}/3): faltou resposta de ${missingSensors.join(', ')}.`,
    calibrated: Boolean(wallCfg.calibration?.calibrated),
    propagationSpeedMps: wallCfg.calibration?.propagationSpeedMps || null,
    xMeters: isComplete ? tdoa.xMeters : null,
    yMeters: isComplete ? tdoa.yMeters : null,
    xNormalized: isComplete ? tdoa.xNormalized : null,
    yNormalized: isComplete ? tdoa.yNormalized : null,
    screenXPct: isComplete ? tdoa.screenXPct : null,
    screenYPct: isComplete ? tdoa.screenYPct : null,
    sectorId: isComplete ? tdoa.sectorId : null,
    sectorClassification: isComplete ? tdoa.sectorClassification : null,
    residualRmsM: isComplete ? tdoa.residualRmsM : null,
    residualMaxM: isComplete ? tdoa.residualMaxM : null
  };

  lastHardwareDiagnostic = record;
  pushDiagnosticHistory(record);
  broadcastEvent('IOT_DIAGNOSTIC_UPDATED', record);
  return record;
}

/**
 * Obtém a configuração de referência para cálculos IoT (prioriza a configuração persistida de Nicolas).
 */
async function resolveReferenceWallConfig(actor = null) {
  if (actor) {
    return getWallConfigForActor(actor);
  }
  const nicolas = await getNicolasAccount();
  if (nicolas) {
    return getWallConfigForActor({ type: 'user', userId: nicolas.id });
  }
  return getWallConfigForActor(null);
}

/**
 * Processa uma leitura individual de sensor do Arduino:
 *   { event_id, sensor_id, timestamp_us, device_id, valid, signal_level }
 */
async function ingestSensorReading(rawReading = {}, wallCfg = null) {
  const cfg = wallCfg || (await resolveReferenceWallConfig());
  const groupingWindowUs = Number(cfg.calibration?.groupingWindowUs || 25000);
  const minSignalLevel = Number(cfg.calibration?.minSignalLevel || 0);

  const eventId = rawReading.event_id ?? rawReading.eventId ?? rawReading.id ?? null;
  const deviceId = String(rawReading.device_id ?? rawReading.deviceId ?? 'ARDUINO_MAIN').trim() || 'ARDUINO_MAIN';
  const rawSensor = rawReading.sensor_id ?? rawReading.sensorId ?? rawReading.sensor;
  const sensorId = normalizeSensorId(rawSensor);
  const rawTs = rawReading.timestamp_us ?? rawReading.timestampUs ?? rawReading.timestamp;
  const timestampUs = rawTs !== null && rawTs !== undefined && rawTs !== '' ? Number(rawTs) : NaN;
  const isValidFlag = rawReading.valid !== undefined ? Boolean(rawReading.valid) : true;
  const signalLevel = rawReading.signal_level ?? rawReading.signalLevel ?? rawReading.amplitude ?? null;

  // 1. Rejeição de evento com event_id duplicado
  if (eventId && processedEventIds.has(String(eventId).trim())) {
    const dupRecord = {
      eventId: String(eventId).trim(),
      deviceId,
      sensorId,
      timestampUs: Number.isFinite(timestampUs) ? timestampUs : null,
      receivedAt: new Date().toISOString(),
      accepted: false,
      status: 'REJECTED_DUPLICATE_EVENT',
      groupingState: 'DUPLICATE_EVENT',
      reason: 'DUPLICATE_EVENT_ID',
      message: `Evento duplicado (${eventId}) descartado.`
    };
    pushDiagnosticHistory(dupRecord);
    return dupRecord;
  }

  // 2. Validação de ruído, leitura marcada como inválida, sensor inexistente ou timestamp inválido
  if (!isValidFlag) {
    if (eventId) rememberEventId(eventId);
    const noiseRec = {
      eventId: eventId || `noise_${Date.now()}`,
      deviceId,
      sensorId,
      timestampUs: Number.isFinite(timestampUs) ? timestampUs : null,
      receivedAt: new Date().toISOString(),
      accepted: false,
      status: 'REJECTED_INVALID_READING',
      groupingState: 'NOISE_REJECTED',
      reason: 'READING_MARKED_INVALID',
      message: 'Leitura marcada como inválida pelo microcontrolador (ruído descartado).'
    };
    pushDiagnosticHistory(noiseRec);
    return noiseRec;
  }

  if (signalLevel !== null && Number.isFinite(Number(signalLevel)) && minSignalLevel > 0 && Number(signalLevel) < minSignalLevel) {
    if (eventId) rememberEventId(eventId);
    const lowAmpRec = {
      eventId: eventId || `noise_${Date.now()}`,
      deviceId,
      sensorId,
      timestampUs: Number.isFinite(timestampUs) ? timestampUs : null,
      receivedAt: new Date().toISOString(),
      accepted: false,
      status: 'REJECTED_NOISE',
      groupingState: 'NOISE_REJECTED',
      reason: 'BELOW_NOISE_THRESHOLD',
      message: `Sinal (${signalLevel}) abaixo do limiar de ruído (${minSignalLevel}).`
    };
    pushDiagnosticHistory(lowAmpRec);
    return lowAmpRec;
  }

  if (!sensorId || !VALID_SENSORS.has(sensorId) || !Number.isFinite(timestampUs) || timestampUs < 0) {
    const badRec = {
      eventId: eventId || `bad_${Date.now()}`,
      deviceId,
      sensorId: rawSensor || null,
      timestampUs: Number.isFinite(timestampUs) ? timestampUs : null,
      receivedAt: new Date().toISOString(),
      accepted: false,
      status: 'REJECTED_MALFORMED',
      groupingState: 'INVALID_FORMAT',
      reason: !sensorId ? 'INVALID_SENSOR_ID' : 'INVALID_TIMESTAMP_US',
      message: !sensorId
        ? `Identificador de sensor inválido (${rawSensor}). Use apenas S1, S2 ou S3.`
        : 'Timestamp em microssegundos ausente ou inválido.'
    };
    pushDiagnosticHistory(badRec);
    return badRec;
  }

  if (eventId) rememberEventId(eventId);

  connectionState.lastArduinoPacketAt = new Date().toISOString();
  connectionState.lastDeviceId = deviceId;

  let finalizedPreviousGroup = null;
  let currentGroup = pendingGroupsByDevice.get(deviceId) || null;

  // 3. Se já existe grupo pendente para este deviceId, verifica se a leitura está dentro da janela temporal
  if (currentGroup) {
    const deltaFromFirstUs = signedMicrosDiff(timestampUs, currentGroup.firstTimestampUs);
    if (deltaFromFirstUs === null || Math.abs(deltaFromFirstUs) > groupingWindowUs) {
      // A leitura atual pertence a OUTRO impacto! Fecha o grupo anterior como incompleto.
      finalizedPreviousGroup = finalizeGroup(currentGroup, 'WINDOW_EXPIRED_INCOMPLETE', cfg);
      pendingGroupsByDevice.delete(deviceId);
      currentGroup = null;
    }
  }

  // 4. Cria novo grupo se não houver grupo ativo
  if (!currentGroup) {
    const isSim = Boolean(rawReading.is_simulation || rawReading.isSimulation || deviceId.toUpperCase().includes('SIMULAT'));
    currentGroup = {
      groupId: `grp_${crypto.randomUUID()}`,
      deviceId,
      isSimulation: isSim,
      firstTimestampUs: timestampUs,
      lastEventId: eventId || null,
      createdAtMs: Date.now(),
      duplicateSensorTriggers: 0,
      readings: {}
    };
    pendingGroupsByDevice.set(deviceId, currentGroup);
  }

  // 5. Se o mesmo sensor (ex.: S1) disparar novamente dentro do mesmo impacto (reverberação local),
  //    preserva o primeiro instante de detecção (borda de subida inicial) e contabiliza disparo duplicado.
  if (currentGroup.readings[sensorId]) {
    currentGroup.duplicateSensorTriggers += 1;
    const existingTs = currentGroup.readings[sensorId].timestampUs;
    // Se por acaso os pacotes chegaram fora de ordem e o novo timestamp for ligeiramente anterior dentro da janela, usa o menor
    if (signedMicrosDiff(timestampUs, existingTs) < 0) {
      currentGroup.readings[sensorId] = {
        eventId: eventId || currentGroup.readings[sensorId].eventId,
        sensorId,
        timestampUs: Math.round(timestampUs)
      };
    }
    return {
      accepted: false,
      duplicateSensorInGroup: true,
      status: 'DUPLICATE_SENSOR_IN_GROUP',
      groupingState: 'WAITING_OTHER_SENSORS',
      reason: 'SENSOR_ALREADY_TRIGGERED_IN_GROUP',
      message: `Disparo repetido do sensor ${sensorId} dentro da mesma janela temporal ignorado (preservado primeiro pulso).`,
      groupId: currentGroup.groupId,
      presentSensors: Object.keys(currentGroup.readings),
      finalizedPreviousGroup
    };
  }

  // Registra a leitura do sensor no grupo
  currentGroup.readings[sensorId] = {
    eventId: eventId || `${deviceId}_${sensorId}_${timestampUs}`,
    sensorId,
    timestampUs: Math.round(timestampUs)
  };
  if (eventId) currentGroup.lastEventId = eventId;

  // Atualiza firstTimestampUs caso leituras do mesmo pacote cheguem fora de ordem
  if (signedMicrosDiff(timestampUs, currentGroup.firstTimestampUs) < 0) {
    currentGroup.firstTimestampUs = Math.round(timestampUs);
  }

  const presentSensors = Object.keys(currentGroup.readings);

  // 6. Se os 3 sensores (S1, S2 e S3) já foram registrados dentro da janela temporal, fecha o impacto imediatamente!
  if (presentSensors.length === 3) {
    pendingGroupsByDevice.delete(deviceId);
    const completedImpact = finalizeGroup(currentGroup, 'ALL_THREE_SENSORS_RECEIVED', cfg);
    lastCompletedImpactByDevice.set(deviceId, {
      firstTimestampUs: currentGroup.firstTimestampUs,
      completedAtMs: Date.now(),
      groupId: currentGroup.groupId
    });
    return {
      accepted: true,
      status: 'IMPACT_GROUP_COMPLETED',
      groupingState: 'COMPLETE_3_OF_3',
      impact: completedImpact,
      finalizedPreviousGroup
    };
  }

  return {
    accepted: true,
    status: 'READING_BUFFERED',
    groupingState: 'WAITING_OTHER_SENSORS',
    groupId: currentGroup.groupId,
    presentSensors,
    missingSensors: ['S1', 'S2', 'S3'].filter((s) => !currentGroup.readings[s]),
    finalizedPreviousGroup
  };
}

/**
 * Processa um lote de leituras ou um pacote de impacto do Arduino.
 * Permite:
 *   - { readings: [ { event_id, sensor_id, timestamp_us, device_id, valid }, ... ], finalize_pending: true }
 *   - { event_id, device_id, t1_us, t2_us, t3_us, valid }
 *   - ou uma leitura individual { event_id, sensor_id, timestamp_us, device_id, valid }
 */
async function ingestArduinoPayload(payload = {}, actor = null) {
  const cfg = await resolveReferenceWallConfig(actor);

  // Caso 1: formato pré-agrupado { event_id, t1_us, t2_us, t3_us, device_id, valid }
  if (
    payload &&
    (payload.t1_us !== undefined || payload.t2_us !== undefined || payload.t3_us !== undefined ||
     payload.t1Us !== undefined || payload.t2Us !== undefined || payload.t3Us !== undefined)
  ) {
    const baseEventId = payload.event_id || payload.eventId || null;
    if (baseEventId && processedEventIds.has(String(baseEventId).trim())) {
      return {
        accepted: false,
        duplicate: true,
        status: 'REJECTED_DUPLICATE_EVENT',
        groupingState: 'DUPLICATE_EVENT',
        reason: 'DUPLICATE_EVENT_ID',
        message: `Evento duplicado (${baseEventId}) rejeitado.`
      };
    }

    const deviceId = payload.device_id || payload.deviceId || 'ARDUINO_MAIN';
    const valid = payload.valid !== undefined ? Boolean(payload.valid) : true;
    const t1 = payload.t1_us ?? payload.t1Us ?? null;
    const t2 = payload.t2_us ?? payload.t2Us ?? null;
    const t3 = payload.t3_us ?? payload.t3Us ?? null;

    if (!valid) {
      if (baseEventId) rememberEventId(baseEventId);
      return {
        accepted: false,
        status: 'REJECTED_INVALID_READING',
        groupingState: 'NOISE_REJECTED',
        reason: 'READING_MARKED_INVALID'
      };
    }

    // Limpa grupo anterior pendente do mesmo device se existir
    const prev = pendingGroupsByDevice.get(deviceId);
    if (prev) {
      finalizeGroup(prev, 'SUPERSEDED_BY_PACKET', cfg);
      pendingGroupsByDevice.delete(deviceId);
    }

    const isSim = Boolean(payload.is_simulation || payload.isSimulation || deviceId.toUpperCase().includes('SIMULAT'));
    const syntheticReadings = [];
    if (t1 !== null && t1 !== undefined && t1 !== '') {
      syntheticReadings.push({ event_id: baseEventId ? `${baseEventId}_S1` : null, sensor_id: 'S1', timestamp_us: t1, device_id: deviceId, valid: true, is_simulation: isSim });
    }
    if (t2 !== null && t2 !== undefined && t2 !== '') {
      syntheticReadings.push({ event_id: baseEventId ? `${baseEventId}_S2` : null, sensor_id: 'S2', timestamp_us: t2, device_id: deviceId, valid: true, is_simulation: isSim });
    }
    if (t3 !== null && t3 !== undefined && t3 !== '') {
      syntheticReadings.push({ event_id: baseEventId ? `${baseEventId}_S3` : null, sensor_id: 'S3', timestamp_us: t3, device_id: deviceId, valid: true, is_simulation: isSim });
    }

    if (baseEventId) rememberEventId(baseEventId);

    if (syntheticReadings.length === 0) {
      return {
        accepted: false,
        status: 'REJECTED_MALFORMED',
        groupingState: 'INVALID_FORMAT',
        reason: 'EMPTY_READINGS'
      };
    }

    const stepResults = [];
    let completedImpact = null;
    for (const r of syntheticReadings) {
      const res = await ingestSensorReading(r, cfg);
      stepResults.push(res);
      if (res.impact) completedImpact = res.impact;
      if (res.finalizedPreviousGroup && !completedImpact) {
        completedImpact = res.finalizedPreviousGroup;
      }
    }

    // Se o pacote enviou apenas 1 ou 2 sensores (leitura incompleta), fecha imediatamente o grupo pendente como INCOMPLETE
    const leftover = pendingGroupsByDevice.get(deviceId);
    if (leftover) {
      pendingGroupsByDevice.delete(deviceId);
      const incompleteImpact = finalizeGroup(leftover, 'INCOMPLETE_PACKET', cfg);
      return {
        accepted: false,
        status: 'REJECTED_INCOMPLETE_PACKET',
        groupingState: 'INCOMPLETE',
        reason: 'INCOMPLETE_READINGS',
        impact: incompleteImpact,
        steps: stepResults
      };
    }

    if (completedImpact && completedImpact.groupingState !== 'COMPLETE_3_OF_3') {
      return {
        accepted: false,
        status: 'REJECTED_OUT_OF_WINDOW',
        groupingState: completedImpact.groupingState,
        reason: 'READINGS_OUTSIDE_GROUPING_WINDOW',
        impact: completedImpact,
        steps: stepResults
      };
    }

    return {
      accepted: true,
      status: 'PACKET_PROCESSED',
      groupingState: completedImpact ? completedImpact.groupingState : 'COMPLETE_3_OF_3',
      impact: completedImpact,
      steps: stepResults
    };
  }

  // Caso 2: lista de leituras { readings: [...] }
  if (Array.isArray(payload?.readings)) {
    const results = [];
    let lastImpact = null;
    for (const r of payload.readings) {
      const res = await ingestSensorReading(r, cfg);
      results.push(res);
      if (res.impact) lastImpact = res.impact;
      else if (res.finalizedPreviousGroup) lastImpact = res.finalizedPreviousGroup;
    }

    if (payload.finalize_pending || payload.finalizePending) {
      const flushed = await flushPendingGroups(cfg);
      if (flushed.length > 0 && !lastImpact) {
        lastImpact = flushed[flushed.length - 1];
      }
    }

    const allAccepted = results.length > 0 && results.every((r) => r.accepted);
    return {
      accepted: Boolean(lastImpact && lastImpact.groupingState === 'COMPLETE_3_OF_3') || allAccepted,
      status: lastImpact ? lastImpact.groupingState : 'BATCH_PROCESSED',
      groupingState: lastImpact ? lastImpact.groupingState : 'WAITING_OTHER_SENSORS',
      impact: lastImpact,
      results
    };
  }

  // Caso 3: leitura individual
  const singleRes = await ingestSensorReading(payload, cfg);
  if ((payload?.finalize_pending || payload?.finalizePending) && pendingGroupsByDevice.size > 0) {
    const flushed = await flushPendingGroups(cfg);
    if (flushed.length > 0) {
      return {
        ...singleRes,
        accepted: false,
        status: 'REJECTED_INCOMPLETE_READING',
        groupingState: 'INCOMPLETE',
        reason: 'INCOMPLETE_READINGS',
        impact: flushed[0]
      };
    }
  }
  return singleRes;
}

/**
 * Expira grupos pendentes incompletos (por timeout ou solicitação explícita de flush).
 */
async function flushPendingGroups(wallCfg = null, maxAgeMs = 0) {
  const cfg = wallCfg || (await resolveReferenceWallConfig());
  const now = Date.now();
  const flushed = [];
  for (const [deviceId, grp] of pendingGroupsByDevice.entries()) {
    if (maxAgeMs <= 0 || now - grp.createdAtMs >= maxAgeMs) {
      pendingGroupsByDevice.delete(deviceId);
      flushed.push(finalizeGroup(grp, 'WINDOW_EXPIRED_INCOMPLETE', cfg));
    }
  }
  return flushed;
}

function setHardwareConnectionMode(mode, extra = {}) {
  if (mode === 'simulation' || mode === 'connected') {
    connectionState.mode = mode;
  }
  if (extra.port) connectionState.port = String(extra.port);
  if (extra.baudRate) connectionState.baudRate = Number(extra.baudRate);
  return { ...connectionState };
}

/**
 * Retorna o estado completo para o Painel de Diagnóstico IoT (Seção 7).
 */
async function getIotDiagnosticsState(actor = null) {
  const wallCfg = await resolveReferenceWallConfig(actor);
  // Expira automaticamente grupos parciais pendentes há mais de 250ms de relógio de parede
  await flushPendingGroups(wallCfg, 250);

  const pendingList = Array.from(pendingGroupsByDevice.values()).map((g) => ({
    groupId: g.groupId,
    deviceId: g.deviceId,
    firstTimestampUs: g.firstTimestampUs,
    presentSensors: Object.keys(g.readings),
    missingSensors: ['S1', 'S2', 'S3'].filter((s) => !g.readings[s])
  }));

  return {
    wall: {
      preset: wallCfg.preset,
      label: wallCfg.label,
      shortLabel: wallCfg.shortLabel,
      widthM: wallCfg.widthM,
      heightM: wallCfg.heightM,
      aspectRatio: wallCfg.aspectRatio,
      bottomRightHasSensor: false
    },
    sensors: wallCfg.sensors,
    sensorList: wallCfg.sensorList,
    sensorOffsetsCm: wallCfg.sensorOffsetsCm,
    calibration: wallCfg.calibration,
    hardwareConnection: {
      ...connectionState,
      statusLabel: connectionState.mode === 'connected' ? 'Conectado (Arduino / Serial)' : 'Modo Simulação (Sem dependência obrigatória de hardware)'
    },
    pendingGroups: pendingList,
    lastArduinoEvent: lastHardwareDiagnostic,
    lastSimulatedImpact: lastSimulatedDiagnostic,
    recentEvents: diagnosticHistory.slice(0, 15)
  };
}

function resetIotDiagnosticsMemory() {
  processedEventIds.clear();
  processedEventQueue.length = 0;
  pendingGroupsByDevice.clear();
  lastCompletedImpactByDevice.clear();
  lastHardwareDiagnostic = null;
  lastSimulatedDiagnostic = null;
  diagnosticHistory.length = 0;
}

module.exports = {
  normalizeSensorId,
  recordSimulatedImpactDiagnostic,
  ingestSensorReading,
  ingestArduinoPayload,
  flushPendingGroups,
  setHardwareConnectionMode,
  getIotDiagnosticsState,
  resetIotDiagnosticsMemory
};
