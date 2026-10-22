'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { prepareExercises, importExercises } = require('./import-exercises');

test('Admin SDK imports 501 real records into the emulator and resumes without replacing existing edits', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  const requireFunctions = createRequire(path.join(__dirname, '../functions/package.json'));
  const admin = requireFunctions('firebase-admin');
  // Always a demo project and only when the emulator environment is present.
  const app = admin.initializeApp({ projectId: 'demo-appgym-security' }, `exercise-import-${randomUUID()}`);
  try {
    const db = admin.firestore(app);
    const source = JSON.parse(await readFile(path.join(__dirname, 'data/wrkout-exercises.json'), 'utf8'));
    const { documents } = prepareExercises(source);
    const prefix = randomUUID();
    const sample = documents.slice(0, 501).map(data => ({ ...data, id: `${prefix}_${data.id}` }));
    const result = await importExercises(db, sample, { log: () => {} });
    assert.deepEqual(result, { created: 501, skipped: 0, total: 501 });
    const refs = sample.map(data => db.collection('exercises').doc(data.id));
    const stored = await db.getAll(...refs);
    assert.ok(stored.every(snapshot => snapshot.exists));
    assert.deepEqual(stored[0].data(), sample[0]);
    await refs[0].update({ name: 'Manual catalog edit', extraField: 'keep' });
    assert.deepEqual(await importExercises(db, sample, { log: () => {} }), { created: 0, skipped: 501, total: 501 });
    const edited = await refs[0].get();
    assert.equal(edited.get('name'), 'Manual catalog edit');
    assert.equal(edited.get('extraField'), 'keep');
  } finally { await app.delete(); }
});
