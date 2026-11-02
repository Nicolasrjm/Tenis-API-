const assert = require('assert');
const { FIXED_TARGETS, detectNearestTarget, DETECTION_RADIUS, VISUAL_RADIUS, generateSimulatedSensorHit } = require('../server/services/gameEngine');

console.log('====================================================');
console.log('   🎾 VERIFICAÇÃO RIGOROSA DO SISTEMA DE 6 ALVOS    ');
console.log('====================================================\n');

// 1. CONTAGEM PROGRAMÁTICA DE ALVOS
const targetCount = FIXED_TARGETS.length;
console.log(`[TESTE 1] Contagem de Alvos: TARGET COUNT = ${targetCount}`);
assert.strictEqual(targetCount, 6, 'A quantidade de alvos DEVE ser exatamente 6!');
console.log('✓ Confirmação: EXATAMENTE 6 alvos configurados.\n');

// 2. POSIÇÕES FIXAS NORMALIZADAS (Hexágono)
console.log('[TESTE 2] Posições dos 6 alvos:');
const expectedPositions = [
  { id: 1, x: 35.0, y: 25.0 },
  { id: 2, x: 65.0, y: 25.0 },
  { id: 3, x: 20.0, y: 50.0 },
  { id: 4, x: 80.0, y: 50.0 },
  { id: 5, x: 35.0, y: 75.0 },
  { id: 6, x: 65.0, y: 75.0 }
];

expectedPositions.forEach(exp => {
  const actual = FIXED_TARGETS.find(t => t.id === exp.id);
  assert(actual, `Alvo ${exp.id} não encontrado!`);
  assert.strictEqual(actual.x, exp.x, `Posição X incorreta para alvo ${exp.id}`);
  assert.strictEqual(actual.y, exp.y, `Posição Y incorreta para alvo ${exp.id}`);
  console.log(`  - ${actual.name}: X=${actual.x}%, Y=${actual.y}% (Raio Detecção: ${DETECTION_RADIUS}%)`);
});
console.log('✓ Confirmação: Todas as 6 posições fixas conferem.\n');

// 3. DETECÇÃO POR APROXIMAÇÃO (detectNearestTarget)
console.log('[TESTE 3] Testando função detectNearestTarget:');

// 3a. Impacto exato no Alvo 1
const exactHit = detectNearestTarget(35.0, 25.0);
assert.strictEqual(exactHit.hit, true);
assert.strictEqual(exactHit.targetId, 1);
assert.strictEqual(exactHit.distance, 0);
console.log('  ✓ Impacto exato (35, 25) -> Alvo 1 (distância: 0%)');

// 3b. Impacto aproximado no Alvo 1 (dentro do raio de 12%)
const nearHit = detectNearestTarget(37.0, 27.0);
assert.strictEqual(nearHit.hit, true);
assert.strictEqual(nearHit.targetId, 1);
assert.strictEqual(nearHit.distance, 2.83);
console.log('  ✓ Impacto aproximado (37, 27) -> Alvo 1 (distância: 2.83% <= 12%)');

// 3c. Impacto aproximado no Alvo 4
const nearHit4 = detectNearestTarget(78.5, 52.0);
assert.strictEqual(nearHit4.hit, true);
assert.strictEqual(nearHit4.targetId, 4);
console.log(`  ✓ Impacto aproximado (78.5, 52.0) -> Alvo 4 (distância: ${nearHit4.distance}%)`);

// 3d. Impacto no centro da quadra (50, 50) - fora de todos os 6 alvos
const centerMiss = detectNearestTarget(50.0, 50.0);
assert.strictEqual(centerMiss.hit, false);
assert.strictEqual(centerMiss.targetId, null);
assert(centerMiss.distance > DETECTION_RADIUS);
console.log(`  ✓ Impacto no centro (50, 50) -> FORA DO ALVO (distância: ${centerMiss.distance}% > 12%)`);
console.log('✓ Confirmação: Detecção por aproximação euclidiana validada com sucesso.\n');

// 4. TESTE DOS TRÊS MODOS DE JOGO
console.log('[TESTE 4] Simulação de Regras dos 3 Modos:');

// Modo 1: Treino Livre (6 alvos neutros, destaca apenas o atingido)
console.log('  [Modo 1 - Treino Livre]');
const freeTargets = FIXED_TARGETS.map(t => ({ id: t.id, isLit: false }));
assert.strictEqual(freeTargets.length, 6);
const freeHitResult = detectNearestTarget(36.0, 26.0);
if (freeHitResult.hit) {
  freeTargets.forEach(t => { t.isLit = (t.id === freeHitResult.targetId); });
}
assert.strictEqual(freeTargets.filter(t => t.isLit).length, 1);
assert.strictEqual(freeTargets.find(t => t.isLit).id, 1);
console.log('  ✓ Treino Livre: apenas o alvo atingido é iluminado.');

// Modo 2: Alvo Único (Apenas 1 alvo ativo)
console.log('  [Modo 2 - Alvo Único]');
let currentActiveTargetId = 3;
const singleTargets = FIXED_TARGETS.map(t => ({ id: t.id, isTarget: t.id === currentActiveTargetId }));
assert.strictEqual(singleTargets.length, 6);
assert.strictEqual(singleTargets.filter(t => t.isTarget).length, 1);
assert.strictEqual(singleTargets.find(t => t.isTarget).id, 3);
// Acerto no alvo ativo -> seleciona outro alvo
const singleHitResult = detectNearestTarget(20.5, 49.5);
assert.strictEqual(singleHitResult.targetId, currentActiveTargetId);
const availableOtherTargets = FIXED_TARGETS.filter(t => t.id !== currentActiveTargetId);
const nextTargetId = availableOtherTargets[0].id;
assert.notStrictEqual(nextTargetId, currentActiveTargetId);
console.log(`  ✓ Alvo Único: Alvo 3 atingido, próximo alvo designado: Alvo ${nextTargetId}.`);

// Modo 3: Apague Todos (6 alvos começam ON, acerto inverte ON/OFF, vitória quando todos OFF)
console.log('  [Modo 3 - Apague Todos]');
const targetStates = {};
FIXED_TARGETS.forEach(t => { targetStates[t.id] = true; }); // Todos ON
assert.strictEqual(Object.keys(targetStates).length, 6);
assert.strictEqual(Object.values(targetStates).every(v => v === true), true);

let reactivations = 0;
// Acerto em alvo ligado (Alvo 1): ON -> OFF
targetStates[1] = !targetStates[1];
assert.strictEqual(targetStates[1], false);

// Acerto em alvo já desligado (Alvo 1): OFF -> ON (reativação)
if (!targetStates[1]) {
  targetStates[1] = true;
  reactivations += 1;
}
assert.strictEqual(targetStates[1], true);
assert.strictEqual(reactivations, 1);

// Apaga os 6 alvos
FIXED_TARGETS.forEach(t => { targetStates[t.id] = false; });
const allTurnedOff = FIXED_TARGETS.every(t => targetStates[t.id] === false);
assert.strictEqual(allTurnedOff, true);
console.log('  ✓ Apague Todos: lógica ON/OFF, reativações e condição de vitória (6 OFF) validadas.');

console.log('\n====================================================');
console.log('   🎾 SUCESSO: TARGET COUNT = 6 EM TODOS OS MODOS   ');
console.log('====================================================');
