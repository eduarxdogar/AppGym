# Importar el dataset de ejercicios

Estos scripts solo descargan datos y cargan documentos. No cambian Angular, las Cloud Functions ni las reglas.

## Datos descargados

- Origen: [wrkout/exercises.json](https://github.com/wrkout/exercises.json).
- Revisión fija: `5994bea047eee4d39a2c0872be3dd8fdd258ba31`.
- Archivo local: `scripts/data/wrkout-exercises.json`, con 873 registros.
- Procedencia y SHA-256: `scripts/data/wrkout-source.json`.
- Licencia del origen: `scripts/data/WRKOUT-LICENSE.md`.
- La URL del JSON combinado indicada en la solicitud devolvió 404. Se descargaron todos los `exercises/*/exercise.json` y se combinaron localmente, sin ejecutar código del repositorio externo. Se añadió el ID del directorio y todas las URLs de imágenes verificadas en el árbol de esa revisión: 1.746 imágenes en total.
- Los más de 2.500 ejercicios anunciados por el autor corresponden al catálogo comercial de wrkout.xyz, separado del repositorio público de 873 registros. No se duplican ni inventan registros para alcanzar esa cifra.

Para volver a descargar exactamente esa revisión, con Node 22 o posterior:

```powershell
Set-Location "C:\AppGym"
node scripts/download-exercises.js
```

Este paso no usa Firebase. Los textos originales se conservan en inglés; no se descargan las imágenes, solo se guardan sus URLs HTTPS.

## Mapeo de datos

| Campo de origen | Campo guardado |
| --- | --- |
| ID del directorio | ID Firestore estable `wrkout_<SHA-256 truncado>` y `importSource.sourceId` |
| `name` | `name` |
| `primaryMuscles`, `secondaryMuscles` | Arrays originales; el primer músculo principal también se traduce a `muscleGroup` |
| `equipment` | Valor original o `null`, más su etiqueta española en `equipmentRequired` |
| `instructions` | Array de pasos, eliminando líneas vacías |
| `level` | `difficulty`; `expert` se convierte en `advanced` |
| `mechanic` | `type`: `compound`, `isolated` o `unknown` si falta |
| Categoría/equipo | `category` original; `discipline` es `gym` o `calisthenics` |
| Imágenes existentes | Todas las URLs en `images`, primera imagen en `imageUrl`; `videoUrl` queda vacío porque el repositorio no aporta videos |
| Todos los atributos del registro de origen | `sourceData`, incluidos aliases, consejos, descripción y mecánica cuando están presentes |

Se guarda también `instructionsLanguage: 'en'` y la procedencia en `importSource`. Cinco registros no tienen instrucciones y 87 no especifican `mechanic`; se conserva esa ausencia. Los músculos que no pertenecen a las opciones actuales del formulario (por ejemplo, cuello y aductores) mantienen su nombre anatómico; no se reasignan a un músculo diferente.

La revisión se atribuye solo si el SHA-256 del archivo coincide con el manifiesto descargado. Para un archivo editado o distinto, `importSource.revision` queda en `null`.

## Credenciales e instalación

El SDK `firebase-admin` ya está declarado en `functions/package.json` y el script lo reutiliza. No hace falta añadir dependencias al frontend. Si todavía no están instaladas:

```powershell
npm.cmd ci --prefix functions
```

Usa credenciales de administrador con permiso de lectura/escritura de Firestore. Un JSON existente de cuenta de servicio puede indicarse así; sustituye la ruta por la real y mantenlo fuera del repositorio:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Credenciales\appgym-admin.json"
```

La configuración web `environment.ts` y las API keys del navegador no son credenciales del Admin SDK. El proyecto destino del importador es explícitamente `appgym-d8061`.

## Validar e importar

Primero valida el JSON completo, sin credenciales ni conexión a Firebase:

```powershell
node scripts/import-exercises.js --dry-run
```

Resultado esperado: 873 documentos válidos, lotes de 500 y 373. Luego ejecuta:

```powershell
node scripts/import-exercises.js
```

El destino predeterminado es **`exercises`**, tal como se solicitó. El catálogo y el panel actuales de AppGym leen **`global_exercises`**. Si quieres cargar esos mismos datos en el catálogo visible, usa explícitamente:

```powershell
node scripts/import-exercises.js --collection global_exercises --dry-run
node scripts/import-exercises.js --collection global_exercises
```

Cada comando afecta únicamente a la colección elegida. No se sincronizan las dos colecciones automáticamente. También puedes usar `--file "C:\ruta\otro-archivo-wrkout.json"` para leer otro JSON con el mismo formato del dataset elegido.

## Reanudación y errores

- Repite exactamente el comando si se interrumpe. Los IDs dependen del identificador de origen, no del orden de los registros ni de una fecha de ejecución.
- Firestore es el registro de progreso: antes de cada lote se consultan esos IDs y solo se crean los ausentes. No depende de un archivo local de checkpoint.
- Se usa `db.batch()` del Admin SDK (WriteBatch), con hasta 500 operaciones y un límite adicional de tamaño por lote.
- `batch.create()` impide sobrescribir un documento si otra ejecución lo crea entre la lectura y el commit. Se relee el lote en caso de conflicto o resultado de commit incierto.
- Las ejecuciones posteriores omiten los documentos existentes, incluidas ediciones manuales. El importador no actualiza ni elimina ejercicios existentes.
- Se deduplican registros de entrada idénticos. Dos registros con el mismo ID y contenido diferente detienen la validación antes de escribir nada.
- Los errores transitorios tienen hasta cinco intentos con espera creciente. Errores permanentes, como permisos insuficientes, detienen el proceso y devuelven un código de salida distinto de cero.
- Un fallo posterior a un lote correcto no revierte los lotes anteriores; volver a ejecutar completa lo que falta.

## Pruebas

Pruebas locales de mapeo, límites, duplicados, fallos y reanudación:

```powershell
node --test scripts/import-exercises.test.js
```

Prueba real del Admin SDK con 501 documentos, segunda ejecución y conservación de ediciones, exclusivamente en el emulador:

```powershell
npx.cmd firebase emulators:exec --config firebase.security-test.json --project demo-appgym-security --only firestore "node --test scripts/import-exercises.integration.test.js"
```

La prueba de integración necesita Java para el emulador de Firestore. Nunca usa el proyecto productivo.
