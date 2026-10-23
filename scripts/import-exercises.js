'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { parseArgs } = require('node:util');
const { SOURCE, REVISION, OUTPUT } = require('./download-exercises');

const PROJECT_ID = 'appgym-d8061';
const MAX_BATCH_SIZE = 500;
const MAX_BATCH_BYTES = 8 * 1024 * 1024;
const COLLECTIONS = ['exercises', 'global_exercises'];
const MUSCLES = {
  abdominals: 'core', hamstrings: 'isquios', calves: 'gemelos', shoulders: 'hombros',
  adductors: 'aductores', glutes: 'glúteos', quadriceps: 'cuádriceps', biceps: 'bíceps',
  forearms: 'antebrazos', abductors: 'abductores', triceps: 'tríceps', chest: 'pecho',
  'lower back': 'lumbares', traps: 'trapecio', 'middle back': 'espalda', lats: 'espalda', neck: 'cuello',
};
const EQUIPMENT = {
  'body only': 'Calistenia', machine: 'Máquinas', kettlebells: 'Kettlebells', dumbbell: 'Mancuernas',
  cable: 'Polea', barbell: 'Barra', bands: 'Bandas', 'medicine ball': 'Balón medicinal',
  'exercise ball': 'Balón de ejercicio', 'e-z curl bar': 'Barra', 'foam roll': 'Rodillo de espuma',
  other: 'Otros',
};
const DIFFICULTY = { beginner: 'beginner', intermediate: 'intermediate', expert: 'advanced' };

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} debe ser texto no vacío.`);
  return value.trim();
}
function texts(value, field, allowBlank = false) {
  if (!Array.isArray(value)) throw new Error(`${field} debe ser un array.`);
  return value.map((item, index) => {
    if (allowBlank && typeof item === 'string') return item.trim();
    return text(item, `${field}[${index}]`);
  }).filter(Boolean);
}
function mapExercise(raw, { revision = null } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('El ejercicio debe ser un objeto.');
  const name = text(raw.name, 'name');
  const primaryMuscles = texts(raw.primaryMuscles, 'primaryMuscles');
  const secondaryMuscles = texts(raw.secondaryMuscles ?? [], 'secondaryMuscles');
  if (!primaryMuscles.length) throw new Error(`${name}: primaryMuscles está vacío.`);
  for (const muscle of [...primaryMuscles, ...secondaryMuscles]) {
    if (!Object.hasOwn(MUSCLES, muscle)) throw new Error(`${name}: músculo desconocido: ${muscle}.`);
  }
  if (!Object.hasOwn(DIFFICULTY, raw.level)) throw new Error(`${name}: nivel desconocido: ${raw.level}.`);
  if (raw.mechanic != null && !['compound', 'isolation'].includes(raw.mechanic)) throw new Error(`${name}: mechanic inválido.`);
  const equipment = raw.equipment == null ? null : text(raw.equipment, 'equipment');
  if (equipment !== null && !Object.hasOwn(EQUIPMENT, equipment)) throw new Error(`${name}: equipo desconocido: ${equipment}.`);
  const instructions = texts(raw.instructions, 'instructions', true);
  const sourceId = raw.id === undefined ? name : text(raw.id, 'id');
  // Prefix + hash prevents slash/Unicode problems and collisions with manually named documents.
  const id = `wrkout_${createHash('sha256').update(sourceId).digest('hex').slice(0, 32)}`;
  const images = raw.images === undefined ? [] : texts(raw.images, 'images');
  const imageUrl = raw.imageUrl === undefined ? images[0] ?? '' : text(raw.imageUrl, 'imageUrl');
  for (const url of [imageUrl, ...images].filter(Boolean)) {
    if (new URL(url).protocol !== 'https:') throw new Error(`${name}: las imágenes deben usar HTTPS.`);
  }
  const data = {
    id, name, primaryMuscles, secondaryMuscles, equipment, instructions,
    muscleGroup: MUSCLES[primaryMuscles[0]],
    equipmentRequired: equipment === null ? [] : [EQUIPMENT[equipment]],
    discipline: equipment === 'body only' && raw.category !== 'stretching' ? 'calisthenics' : 'gym',
    type: raw.mechanic === 'compound' ? 'compound' : raw.mechanic === 'isolation' ? 'isolated' : 'unknown',
    difficulty: DIFFICULTY[raw.level],
    category: text(raw.category, 'category'),
    imageUrl, images: [...new Set([imageUrl, ...images].filter(Boolean))], videoUrl: '', instructionsLanguage: 'en',
    // Keep every original attribute (aliases, tips, description, force, etc.) for future consumers.
    sourceData: JSON.parse(JSON.stringify(raw)),
    importSource: { dataset: SOURCE, revision, sourceId },
  };
  if (Buffer.byteLength(JSON.stringify(data)) > 900_000) throw new Error(`${name}: documento demasiado grande.`);
  return data;
}

function prepareExercises(input, source = {}) {
  const records = Array.isArray(input) ? input : input?.exercises;
  if (!Array.isArray(records) || !records.length) throw new Error('El JSON debe contener un array no vacío, directamente o en { exercises: [...] }.');
  const documents = new Map();
  let duplicates = 0;
  records.forEach((record, index) => {
    let data;
    try { data = mapExercise(record, source); } catch (error) { throw new Error(`Registro ${index + 1}: ${error.message}`); }
    const existing = documents.get(data.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(data)) throw new Error(`ID duplicado con datos diferentes: ${data.importSource.sourceId}. No se ha importado nada.`);
      duplicates++;
    } else documents.set(data.id, data);
  });
  return { documents: [...documents.values()], duplicates };
}

function batches(documents) {
  const chunks = [];
  let chunk = [];
  let bytes = 0;
  for (const data of documents) {
    const size = Buffer.byteLength(JSON.stringify(data));
    if (chunk.length && (chunk.length === MAX_BATCH_SIZE || bytes + size > MAX_BATCH_BYTES)) {
      chunks.push(chunk); chunk = []; bytes = 0;
    }
    chunk.push(data); bytes += size;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

function retryable(error) {
  // ALREADY_EXISTS can be a concurrent importer or a successful commit whose reply was lost.
  const code = String(error.code ?? '').toLowerCase().replaceAll('_', '-');
  return ['4', '6', '8', '10', '13', '14', 'deadline-exceeded', 'already-exists',
    'resource-exhausted', 'aborted', 'internal', 'unavailable', 'econnreset', 'etimedout'].includes(code);
}

async function importExercises(db, documents, { collection = 'exercises', log = console.log,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!COLLECTIONS.includes(collection)) throw new Error('Colección no permitida. Usa exercises o global_exercises.');
  let created = 0;
  let skipped = 0;
  let processed = 0;
  const chunks = batches(documents);
  for (const [index, chunk] of chunks.entries()) {
    for (let attempt = 0; ; attempt++) {
      try {
        const refs = chunk.map(data => db.collection(collection).doc(data.id));
        const existing = await db.getAll(...refs);
        const missing = chunk.map((data, i) => ({ data, ref: refs[i], exists: existing[i].exists })).filter(item => !item.exists);
        if (missing.length) {
          // Firebase Admin SDK's WriteBatch API: at most 500 create operations per commit.
          const batch = db.batch();
          for (const { ref, data } of missing) batch.create(ref, data);
          await batch.commit();
        }
        created += missing.length;
        skipped += chunk.length - missing.length;
        break;
      } catch (error) {
        if (attempt >= 4 || !retryable(error)) {
          throw new Error(`Lote ${index + 1}/${chunks.length} detenido (${error.code ?? 'error'}): ${error.message}. Repite el mismo comando; los documentos existentes se omiten.`, { cause: error });
        }
        log(`[REINTENTO] Lote ${index + 1}: ${error.code}. Se volverá a comprobar qué documentos existen.`);
        await sleep(500 * 2 ** attempt);
      }
    }
    processed += chunk.length;
    log(`[${processed}/${documents.length}] Lote ${index + 1}/${chunks.length}: ${created} creados; ${skipped} existentes/confirmados al reintentar.`);
  }
  return { created, skipped, total: documents.length };
}

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: 'string', default: OUTPUT }, collection: { type: 'string', default: 'exercises' },
    'dry-run': { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('node scripts/import-exercises.js [--file ruta.json] [--collection exercises|global_exercises] [--dry-run]');
    console.log(`Proyecto fijo: ${PROJECT_ID}. Sin --dry-run escribe en Firestore usando credenciales ADC.`);
    return;
  }
  if (!COLLECTIONS.includes(values.collection)) throw new Error('Colección no permitida. Usa exercises o global_exercises.');
  const file = path.resolve(values.file);
  const raw = await fs.readFile(file, 'utf8');
  let revision = null;
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(__dirname, 'data/wrkout-source.json'), 'utf8'));
    if (manifest.revision === REVISION && manifest.sha256 === createHash('sha256').update(raw).digest('hex')) revision = REVISION;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { documents, duplicates } = prepareExercises(JSON.parse(raw.replace(/^\uFEFF/, '')), { revision });
  console.log(`Archivo: ${file}\nProyecto: ${PROJECT_ID}; colección: ${values.collection}.`);
  console.log(`Revisión: ${revision ?? 'archivo local no verificado contra el manifiesto (revision: null)'}.`);
  console.log(`${documents.length} documentos válidos; ${duplicates} duplicados idénticos omitidos; lotes: ${batches(documents).map(chunk => chunk.length).join(', ')}.`);
  console.log(`[DATOS] ${documents.filter(doc => !doc.instructions.length).length} sin instrucciones; ${documents.filter(doc => doc.type === 'unknown').length} sin tipo indicado en origen. No se inventan esos valores.`);
  console.log('Modo de reanudación: crear solo IDs ausentes; conservar documentos existentes y ediciones manuales.');
  if (values.collection === 'exercises') console.log('[NOTA] El catálogo visible actual de AppGym lee global_exercises.');
  if (values['dry-run']) {
    console.log('[OK] Validación terminada. No se inicializó Firebase ni se escribió en Firestore.');
    return;
  }
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) throw new Error('Define GOOGLE_APPLICATION_CREDENTIALS con la ruta del JSON de cuenta de servicio.');
  try { await fs.access(credentialsPath); }
  catch { throw new Error(`No se puede leer el archivo de credenciales: ${credentialsPath}. Comprueba la ruta y la extensión .json.`); }
  const requireFunctions = createRequire(path.join(__dirname, '../functions/package.json'));
  const admin = requireFunctions('firebase-admin');
  const app = admin.initializeApp({ projectId: PROJECT_ID, credential: admin.credential.applicationDefault() }, 'import-exercises');
  try {
    const result = await importExercises(admin.firestore(app), documents, { collection: values.collection });
    console.log(`[OK] Importación terminada: ${result.total} documentos confirmados (${result.created} creados, ${result.skipped} ya existentes).`);
  } finally { await app.delete(); }
}

if (require.main === module) main().catch(error => { console.error(`[ERROR] ${error.message}`); process.exitCode = 1; });

module.exports = { mapExercise, prepareExercises, batches, importExercises, MAX_BATCH_SIZE };
