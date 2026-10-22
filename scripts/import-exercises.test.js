'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { mapExercise, prepareExercises, importExercises, batches } = require('./import-exercises');

const example = { id: 'Barbell_Curl', name: 'Barbell Curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'],
  equipment: 'barbell', level: 'expert', mechanic: 'isolation', category: 'strength', instructions: ['Keep elbows still.'] };
const fixture = count => prepareExercises(Array.from({ length: count }, (_, i) => ({ ...example, id: `exercise-${i}` }))).documents;
const codedError = code => Object.assign(new Error('Simulated failure'), { code });

function fakeFirestore() {
  const records = new Map();
  const commitSizes = [];
  let beforeCommit;
  let afterCommit;
  return {
    records, commitSizes,
    beforeCommit: callback => { beforeCommit = callback; },
    afterCommit: callback => { afterCommit = callback; },
    collection: collection => ({ doc: id => ({ path: `${collection}/${id}` }) }),
    getAll: async (...refs) => refs.map(ref => ({ exists: records.has(ref.path) })),
    batch: () => {
      const writes = [];
      return {
        create: (ref, data) => { writes.push({ ref, data }); },
        commit: async () => {
          await beforeCommit?.(writes);
          if (writes.length > 500) throw new Error('Batch too large');
          if (writes.some(w => records.has(w.ref.path))) throw codedError(6);
          commitSizes.push(writes.length);
          for (const { ref, data } of writes) records.set(ref.path, structuredClone(data));
          await afterCommit?.(writes);
        },
      };
    },
  };
}
const quiet = { log: () => {}, sleep: async () => {} };

test('maps source metadata to the current catalog fields without inventing missing information', () => {
  const mapped = mapExercise(example);
  assert.equal(mapped.name, 'Barbell Curl');
  assert.equal(mapped.muscleGroup, 'bíceps');
  assert.deepEqual(mapped.equipmentRequired, ['Barra']);
  assert.equal(mapped.type, 'isolated');
  assert.equal(mapped.difficulty, 'advanced');
  assert.equal(mapped.importSource.revision, null);
  assert.equal(mapExercise(example, { revision: 'verified-snapshot' }).importSource.revision, 'verified-snapshot');
  assert.deepEqual(mapped.primaryMuscles, ['biceps']);
  assert.deepEqual(mapped.instructions, example.instructions);
  const media = mapExercise({ ...example, images: ['https://example.test/0.jpg', 'https://example.test/1.jpg'], tips: ['Original tip'] });
  assert.deepEqual(media.images, ['https://example.test/0.jpg', 'https://example.test/1.jpg']);
  assert.equal(media.imageUrl, 'https://example.test/0.jpg');
  assert.deepEqual(media.sourceData.tips, ['Original tip']);
  assert.match(mapped.id, /^wrkout_[a-f0-9]{32}$/);
  assert.equal(mapped.id, mapExercise({ ...example, name: 'Renamed display text' }).id);
  const incomplete = mapExercise({ ...example, equipment: null, mechanic: null, instructions: [] });
  assert.equal(incomplete.type, 'unknown');
  assert.equal(incomplete.equipment, null);
  assert.deepEqual(incomplete.equipmentRequired, []);
  assert.deepEqual(incomplete.instructions, []);
  assert.deepEqual(mapExercise({ ...example, instructions: [' ', ' Keep the original step. ', ''] }).instructions, ['Keep the original step.']);
});

test('rejects invalid input and conflicting duplicates before creating a Firebase client', () => {
  assert.throws(() => prepareExercises([]), /array no vacío/);
  assert.throws(() => prepareExercises([example, { ...example, primaryMuscles: ['invented'] }]), /Registro 2/);
  assert.throws(() => prepareExercises([example, { ...example, name: 'Conflicting name' }]), /ID duplicado/);
  assert.throws(() => prepareExercises([{ ...example, imageUrl: 'javascript:alert(1)' }]), /HTTPS/);
  assert.throws(() => prepareExercises([{ ...example, instructions: [undefined] }]), /instructions/);
  const prepared = prepareExercises({ exercises: [example, { ...example }] });
  assert.equal(prepared.documents.length, 1);
  assert.equal(prepared.duplicates, 1);
});

test('873 exercises use batches of 500 and 373 and reruns preserve manual edits', async () => {
  const db = fakeFirestore();
  const docs = fixture(873);
  assert.deepEqual(await importExercises(db, docs, quiet), { created: 873, skipped: 0, total: 873 });
  assert.deepEqual(db.commitSizes, [500, 373]);
  db.records.get(`exercises/${docs[0].id}`).name = 'Manual edit';
  assert.deepEqual(await importExercises(db, docs, quiet), { created: 0, skipped: 873, total: 873 });
  assert.deepEqual(db.commitSizes, [500, 373]);
  assert.equal(db.records.get(`exercises/${docs[0].id}`).name, 'Manual edit');
});

test('interruption after the first commit resumes from Firestore without a local checkpoint', async () => {
  const db = fakeFirestore();
  const docs = fixture(502);
  db.beforeCommit(() => { if (db.records.size === 500) throw codedError(7); });
  await assert.rejects(importExercises(db, docs, quiet), /Lote 2\/2 detenido/);
  assert.equal(db.records.size, 500);
  db.beforeCommit(undefined);
  assert.deepEqual(await importExercises(db, docs, quiet), { created: 2, skipped: 500, total: 502 });
  assert.equal(db.records.size, 502);
});

test('a successful commit with a lost reply is confirmed rather than duplicated', async () => {
  const db = fakeFirestore();
  db.afterCommit(() => { throw codedError(4); });
  const result = await importExercises(db, fixture(3), quiet);
  assert.equal(result.total, 3);
  assert.equal(db.records.size, 3);
  assert.deepEqual(db.commitSizes, [3]);
});

test('concurrent creation is retried with fresh reads and never overwrites the winner', async () => {
  const db = fakeFirestore();
  const docs = fixture(2);
  db.beforeCommit(writes => {
    db.beforeCommit(undefined);
    db.records.set(writes[0].ref.path, { name: 'Concurrent edit' });
  });
  const result = await importExercises(db, docs, quiet);
  assert.deepEqual(result, { created: 1, skipped: 1, total: 2 });
  assert.equal(db.records.get(`exercises/${docs[0].id}`).name, 'Concurrent edit');
});

test('transient failures have bounded retries, permission errors stop immediately, and collection paths are restricted', async () => {
  for (const [code, expectedCalls] of [[14, 5], [7, 1]]) {
    const db = fakeFirestore();
    let calls = 0;
    db.beforeCommit(() => { calls++; throw codedError(code); });
    await assert.rejects(importExercises(db, fixture(1), quiet), /detenido/);
    assert.equal(calls, expectedCalls);
    assert.equal(db.records.size, 0);
  }
  await assert.rejects(importExercises(fakeFirestore(), fixture(1), { ...quiet, collection: 'users/admin' }), /Colección no permitida/);
});

test('optional catalog import and byte-bound batches do not exceed operation limits', async () => {
  const db = fakeFirestore();
  const docs = fixture(1);
  await importExercises(db, docs, { ...quiet, collection: 'global_exercises' });
  assert.equal(db.records.has(`global_exercises/${docs[0].id}`), true);
  const large = Array.from({ length: 12 }, (_, i) => ({ id: String(i), instructions: ['x'.repeat(800_000)] }));
  const chunks = batches(large);
  assert.equal(chunks.length, 2);
  assert.equal(chunks.flat().length, large.length);
  assert.ok(chunks.every(chunk => chunk.length <= 500 && Buffer.byteLength(JSON.stringify(chunk)) < 8.1 * 1024 * 1024));
});

test('the entire downloaded dataset validates and its pinned manifest checksum matches', async () => {
  const file = await readFile(require('node:path').join(__dirname, 'data/wrkout-exercises.json'), 'utf8');
  const manifest = JSON.parse(await readFile(require('node:path').join(__dirname, 'data/wrkout-source.json'), 'utf8'));
  assert.equal(createHash('sha256').update(file).digest('hex'), manifest.sha256);
  const { documents, duplicates } = prepareExercises(JSON.parse(file));
  assert.equal(documents.length, manifest.records);
  assert.equal(documents.length, 873);
  assert.equal(duplicates, 0);
  assert.deepEqual(batches(documents).map(chunk => chunk.length), [500, 373]);
});
