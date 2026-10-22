const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isBodyweightProfile, bodyweightPolicy } = require('../lib/workout-policy');
const catalog = [
  { id: 'pushup', name: 'Push-Up', muscleGroup: 'Pecho', equipment: 'body only', imageUrl: 'https://example.com/pushup.jpg' },
  { id: 'squat', name: 'Squat', muscleGroup: 'Piernas', equipmentRequired: ['Calistenia'] },
  { id: 'press', name: 'Bench Press', muscleGroup: 'Pecho', equipment: 'barbell', equipmentRequired: ['Barra'] },
];
const workout = exercises => ({ nombre: 'Casa', nivelDificultad: 'intermedio', ejercicios: exercises });

test('bodyweight policy detects canonical, absent gym and legacy Home Gym or calisthenics profiles', () => {
  for (const profile of [{}, { baseGym: ' Home Gym ' }, { baseGym: 'Calistenia' },
    { availableEquipment: ['BODYWEIGHT'] }, { baseGym: 'Otro', equipment: ['Calistenia'] },
    { baseGym: 'Home Gym', availableEquipment: ['Máquinas'] }, { baseGym: 'Otro', equipment: [] },
    { baseGym: 'Otro', availableEquipment: [] }, { baseGym: 'Otro' },
    { baseGym: 'Otro', availableEquipment: ['BODYWEIGHT'], equipment: ['Calistenia'] }]) assert.equal(isBodyweightProfile(profile), true);
  for (const profile of [{ baseGym: 'Smart Fit', equipment: ['Máquinas'] },
    { baseGym: 'Bodytech', availableEquipment: ['Mancuernas'] }]) assert.equal(isBodyweightProfile(profile), false);
});
test('prompt whitelists only real bodyweight catalog entries and requires zero external load', () => {
  const policy = bodyweightPolicy(catalog);
  assert.ok(policy.systemInstruction.includes('BODYWEIGHT'));
  assert.ok(policy.systemInstruction.includes('Push-Up'));
  assert.equal(policy.systemInstruction.includes('Bench Press'), false);
  assert.throws(() => bodyweightPolicy([catalog[2]]));
});
test('normalizes single and weekly exercises to catalog identity, image and zero weight, including supersets', () => {
  const policy = bodyweightPolicy(catalog);
  const input = workout([{ id: 'pushup', nombre: 'Flexiones', pesokg: 30, superSetEjercicio: { id: 2, nombre: 'Squat', pesokg: 10 } }]);
  const output = JSON.parse(policy.validateOutput(JSON.stringify(input)));
  assert.equal(output.ejercicios[0].nombre, 'Push-Up');
  assert.equal(output.ejercicios[0].pesokg, 0);
  assert.equal(output.ejercicios[0].imageUrl, catalog[0].imageUrl);
  assert.deepEqual(output.ejercicios[0].equipmentRequired, ['BODYWEIGHT']);
  assert.equal(output.ejercicios[0].superSetEjercicio.id, 'squat');
  assert.equal(output.ejercicios[0].superSetEjercicio.pesokg, 0);
  assert.equal(JSON.parse(policy.validateOutput(JSON.stringify([input]))).length, 1);
});
test('rejects foreign exercises, nested supersets, dropsets, empty or malformed workouts', () => {
  const validate = bodyweightPolicy(catalog).validateOutput;
  for (const input of [null, [], {}, workout([]), workout([null]), workout([{ id: 'press', nombre: 'Bench Press' }]),
    workout([{ id: 'pushup', dropSet: {} }]), workout([{ id: 'pushup', superSetEjercicio: { id: 'squat', superSetEjercicio: { id: 'pushup' } } }]),
    Array.from({ length: 8 }, () => workout([{ id: 'pushup' }]))]) assert.throws(() => validate(JSON.stringify(input)));
});
