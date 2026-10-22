# Orquestación de IA

El texto de `callGemini`, `generateWorkoutPlanAI`, `generateNutritionPlanAI`,
`generateBoxingPlanAI` y `chatAI` usa `orchestrateAi(prompt): Promise<string>`.
Los nombres históricos siguen disponibles para clientes existentes; no hay
respuestas simuladas de éxito cuando todos los proveedores fallan.

La cadena es OpenAI (`gpt-4.1-mini`) → DeepSeek (`deepseek-flash`) → Gemini
(`gemini-2.5-flash` o `gemini-2.5-pro`). Cada proveedor tiene como máximo
10 segundos, incluyendo la lectura del cuerpo. El timeout aborta la petición y
libera el temporizador; los errores HTTP, de red, JSON inválido o validación de
catálogo pasan al siguiente proveedor. Las claves Gemini rotan ante fallos
transitorios dentro del mismo presupuesto de diez segundos, sin ampliarlo.

Los logs contienen únicamente proveedor y estado numérico. No registrar claves,
prompts, historial, imágenes, cuerpos de error ni excepciones del SDK.
La respuesta final fallida es un `HttpsError` controlado con
`providerAttemptsComplete: true`, para evitar multiplicar reintentos del cliente.

## Configuración

Node 22. Secret Manager: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`,
`GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`. Todas se resuelven en la invocación y se
declaran en las dependencias secretas de los callables. Nunca guardar valores
en el repositorio o en el bundle Angular. Las cuentas de cada proveedor deben
tener saldo/cuota; una clave válida no garantiza disponibilidad de facturación.

Las imágenes y PDF de InBody, etiquetas y chat conservan la ruta multimodal de
Gemini y su rotación existente. No se envía un adjunto a un modelo de texto
descartándolo silenciosamente. Esa ruta mantiene sus plazos anteriores y no
forma parte de la nueva cadena exclusivamente textual.

Todos los endpoints verifican Auth, suscripción/prueba vigente y presupuesto de
payload antes de consumir APIs. El adaptador conserva historial y la forma de
respuesta `{ text }`. La salida JSON admite objetos y arrays raíz; no se fuerza
`json_object`, que impediría los arrays semanales existentes.

## Rutinas y calistenia

Onboarding sin gimnasio, Home Gym o Calistenia guarda
`availableEquipment: ['BODYWEIGHT']`, además del campo de compatibilidad
`equipment: ['Calistenia']`. El servicio de perfiles mantiene ambos al guardar
o editar equipo. Gimnasios comerciales conservan su selección de material.

`TrainerAiService` etiqueta sus llamadas con `purpose: 'workout'`. El servidor
usa el perfil real del UID autenticado, consulta `global_exercises` y añade una
lista permitida de ejercicios de peso corporal. Valida cada ejercicio y superset,
rechaza ejercicios ajenos y dropsets, conserva ID/nombre/imagen del catálogo y
fija carga externa a cero. Si un proveedor viola la lista, se prueba el siguiente.
Si el catálogo no está disponible, se devuelve un error, nunca una rutina inventada.

La semana se genera mediante solicitudes diarias independientes, con un split
común, contexto de fatiga/equipo y notas breves. Así cada respuesta cabe en el
plazo del proveedor. Se conservan orden y días disponibles; si falla un día no se
publica una semana parcial. Una rutina debe tener entre uno y siete días.

## Verificación reproducible

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --code-coverage
npm run test:backend
npm run test:orchestrator
npm run test:scripts
npm run test:rules
npm run build -- --configuration production
```

`test:orchestrator` exige 100% de líneas/funciones y al menos 95% de ramas en los
dos módulos nuevos. Esta métrica es específica; no representa la cobertura de
toda la aplicación. Los tests Firebase usan exclusivamente el proyecto demo y
el emulador, sin credenciales ni escrituras en producción.

Referencias de contratos: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[DeepSeek](https://api-docs.deepseek.com/), [Gemini](https://ai.google.dev/gemini-api/docs/generate-content).
