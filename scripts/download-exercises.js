'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const SOURCE = 'wrkout/exercises.json';
const REVISION = '5994bea047eee4d39a2c0872be3dd8fdd258ba31';
const RAW_BASE = `https://raw.githubusercontent.com/${SOURCE}/${REVISION}`;
const OUTPUT = path.join(__dirname, 'data/wrkout-exercises.json');

async function download(url, json = false) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'AppGym-exercise-import' }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${url}`);
        error.retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        throw error;
      }
      return json ? await response.json() : await response.text();
    } catch (error) {
      if (attempt >= 3 || error.retryable === false || error instanceof SyntaxError) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

async function main() {
  const tree = await download(`https://api.github.com/repos/${SOURCE}/git/trees/${REVISION}?recursive=1`, true);
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('El listado del repositorio está incompleto.');
  const files = tree.tree.filter(file => /^exercises\/[^/]+\/exercise\.json$/.test(file.path)).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (!files.length) throw new Error('No se encontraron ejercicios en la revisión elegida.');
  const exercises = new Array(files.length);
  let cursor = 0;
  let completed = 0;
  console.log(`Descargando ${files.length} JSON desde ${SOURCE}@${REVISION}.`);
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index];
      const record = await download(`${RAW_BASE}/${file.path.split('/').map(encodeURIComponent).join('/')}`, true);
      const sourceId = file.path.split('/')[1];
      const images = tree.tree.filter(entry => entry.type === 'blob'
        && entry.path.startsWith(`exercises/${sourceId}/images/`)
        && /\.(jpe?g|png|webp|gif)$/i.test(entry.path)).map(entry => entry.path).sort()
        .map(imagePath => `${RAW_BASE}/${imagePath.split('/').map(encodeURIComponent).join('/')}`);
      exercises[index] = { ...record, id: sourceId,
        images, ...(images.length ? { imageUrl: images[0] } : {}),
      };
      completed++;
      if (completed % 100 === 0 || completed === files.length) console.log(`Descargados ${completed}/${files.length}.`);
    }
  }));
  const license = await download(`${RAW_BASE}/LICENSE.md`);
  const json = JSON.stringify({ exercises }, null, 2) + '\n';
  const manifest = { repository: `https://github.com/${SOURCE}`, revision: REVISION,
    originalCombinedUrl: 'https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises.json',
    note: 'Combined URL returned 404; combined all individual exercise.json files. Added directory id and all image URLs verified against the source tree.',
    records: exercises.length, sha256: createHash('sha256').update(json).digest('hex'),
    images: exercises.reduce((sum, exercise) => sum + exercise.images.length, 0),
    license: 'Unlicense', instructionsLanguage: 'en' };
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  const temporary = `${OUTPUT}.${process.pid}.tmp`;
  await fs.writeFile(temporary, json);
  await fs.rename(temporary, OUTPUT);
  await fs.writeFile(path.join(path.dirname(OUTPUT), 'wrkout-source.json'), JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(path.dirname(OUTPUT), 'WRKOUT-LICENSE.md'), license);
  console.log(`[OK] ${OUTPUT} (${exercises.length} ejercicios). No se ha escrito en Firestore.`);
}

if (require.main === module) main().catch(error => { console.error(`[ERROR] ${error.message}`); process.exitCode = 1; });

module.exports = { SOURCE, REVISION, OUTPUT, RAW_BASE };
