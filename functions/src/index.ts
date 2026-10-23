import { onCall, onRequest, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import * as admin from 'firebase-admin';
import { hasSubscriptionAccess, MONTHLY_CURRENCY, MONTHLY_PRICE } from './billing';
import { applyPayment, initializeBilling } from './billing-store';
import { GeminiError, generateWithFallback, parseGeminiPayload } from './gemini';
import { processPaymentNotification } from './payment-webhook';
import { AiUnavailableError, orchestrateAi, AiContext } from './ai-orchestrator';
import { bodyweightPolicy, CatalogExercise, isBodyweightProfile } from './workout-policy';

if (!admin.apps.length) admin.initializeApp();
const geminiKeys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'].map(name => defineSecret(name));
const openaiKey = defineSecret('OPENAI_API_KEY');
const deepseekKey = defineSecret('DEEPSEEK_API_KEY');
const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');
const mpWebhookSecret = defineSecret('MP_WEBHOOK_SECRET');

async function initializeUserBilling(uid: string): Promise<void> {
  const user = await admin.auth().getUser(uid);
  if (user.disabled) throw new HttpsError('permission-denied', 'La cuenta está deshabilitada.');
  await initializeBilling(admin.firestore(), user.uid, Date.parse(user.metadata.creationTime), {
    email: user.email, email_verified: user.emailVerified, vip: user.customClaims?.vip,
  });
}

// Billing initialization is server-only and cannot restart a trial after profile deletion.
export const initializeSubscription = onCall({ cors: true, region: 'us-central1' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  await initializeUserBilling(request.auth.uid);
  return { initialized: true };
});

const aiOptions = {
  cors: true, region: 'us-central1', timeoutSeconds: 300,
  memory: '512MiB' as const, maxInstances: 10, concurrency: 80, secrets: [openaiKey, deepseekKey, ...geminiKeys],
};

async function handleAi(request: CallableRequest<unknown>, defaults?: { isJson: boolean; purpose?: 'workout'; systemInstruction?: string; mediaRequired?: boolean }) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para usar la IA.');
  let data;
  try {
    const input = request.data;
    if (defaults && (!input || typeof input !== 'object' || Array.isArray(input))) throw new Error('Invalid payload');
    data = parseGeminiPayload(defaults ? { model: 'gemini-2.5-flash', isJson: defaults.isJson,
      ...input as Record<string, unknown>, ...(defaults.purpose ? { purpose: defaults.purpose, isJson: true } : {}) } : input);
    if (defaults?.mediaRequired && !data.imageBase64) throw new Error('Missing media');
    if (data.purpose === 'workout' && (!data.isJson || data.imageBase64)) throw new Error('Invalid workout payload');
  }
  catch { throw new HttpsError('invalid-argument', 'Solicitud de IA inválida o demasiado grande.'); }
  const profile = await admin.firestore().doc('users/' + request.auth.uid + '/profile/data').get();
  const billing = profile.data();
  if (billing?.isDeleted || !hasSubscriptionAccess(billing ?? {})) {
    throw new HttpsError('permission-denied', 'La suscripción o el período de prueba no están vigentes.');
  }
  if (data.useSeelegSupplements === true) {
    data = { ...data, prompt: data.prompt + '\nINTEGRACIÓN SEELEG (activada por el usuario): Genera exactamente UNA comida (Snack o Post-Entreno) como una preparación detallada con suplementos Seeleg. Solo esa comida debe incluir isSponsored: true y sponsorBrand: "Seeleg" en el JSON. El resto de comidas no deben incluir esos campos.' };
  }
  try {
    let context: AiContext = { isJson: data.isJson, history: data.history, model: data.model,
      systemInstruction: defaults?.systemInstruction };
    if (data.purpose === 'workout' && isBodyweightProfile(billing ?? {})) {
      const db = admin.firestore();
      const snapshots = await Promise.all([
        db.collection('global_exercises').where('equipment', '==', 'body only').get(),
        db.collection('global_exercises').where('equipmentRequired', 'array-contains', 'Calistenia').get(),
      ]);
      const catalog = new Map<string, CatalogExercise>();
      for (const snapshot of snapshots) for (const doc of snapshot.docs) catalog.set(doc.id, { ...doc.data(), id: doc.id } as CatalogExercise);
      const policy = bodyweightPolicy([...catalog.values()]);
      context = { ...context, ...policy,
        systemInstruction: [context.systemInstruction, policy.systemInstruction].filter(Boolean).join('\n') };
    }
    if (data.imageBase64) {
      return { text: await generateWithFallback({ ...data,
        prompt: [context.systemInstruction, data.prompt].filter(Boolean).join('\n') }, geminiKeys.map(key => key.value())) };
    }
    return { text: await orchestrateAi(data.prompt, context, { keys: {
      openai: openaiKey.value(), deepseek: deepseekKey.value(), gemini: geminiKeys.map(key => key.value()),
    } }) };
  } catch (error: unknown) {
    const status = error instanceof GeminiError || error instanceof AiUnavailableError ? error.status : 500;
    logger.warn('AI request failed', { status });
    throw new HttpsError(status === 429 ? 'resource-exhausted' : status === 504 ? 'deadline-exceeded'
      : status === 503 ? 'unavailable' : 'internal', 'No fue posible completar la solicitud de IA.', { providerAttemptsComplete: true });
  }
}

// Preserve existing callable names/contracts, including deployed legacy clients.
export const callGemini = onCall(aiOptions, request => handleAi(request));
export const generateWorkoutPlanAI = onCall(aiOptions, request => handleAi(request, {
  isJson: true, purpose: 'workout', systemInstruction: 'Eres COACH TRÍADA. Genera rutinas seguras según nivel, objetivo, disponibilidad y fatiga. Respeta exactamente el esquema Workout solicitado.',
}));
export const generateNutritionPlanAI = onCall(aiOptions, request => handleAi(request, {
  isJson: true, systemInstruction: 'Eres un nutricionista deportivo. Respeta el esquema JSON solicitado y los datos del usuario.',
}));
export const generateBoxingPlanAI = onCall(aiOptions, request => handleAi(request, {
  isJson: true, systemInstruction: 'Eres un entrenador de boxeo. Genera un plan seguro con el esquema JSON solicitado.',
}));
export const chatAI = onCall(aiOptions, request => handleAi(request, { isJson: false,
  systemInstruction: 'Eres COACH TRÍADA. Responde en español sobre entrenamiento y nutrición, considerando el contexto y la fatiga del usuario.',
}));
export const analyzeInbodyAI = onCall(aiOptions, request => handleAi(request, { isJson: true, mediaRequired: true,
  systemInstruction: 'Extrae únicamente mediciones visibles del informe InBody. Usa null para valores ausentes, nunca inventes resultados.',
}));
export const analyzeNutritionLabelAI = onCall(aiOptions, request => handleAi(request, { isJson: true, mediaRequired: true,
  systemInstruction: 'Extrae valores por porción (por 100g si no hay porción). Devuelve JSON con calories, protein, carbs y fats numéricos; no inventes mediciones.',
}));

export const createCheckoutSession = onCall({
  cors: true, region: 'us-central1', secrets: [mpAccessToken],
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para pagar.');
  // A direct request or a login race must not charge a user whose trial is not initialized yet.
  await initializeUserBilling(request.auth.uid);
  const profile = await admin.firestore().doc('users/' + request.auth.uid + '/profile/data').get();
  if (profile.get('isDeleted')) throw new HttpsError('permission-denied', 'La cuenta no está disponible.');
  if (hasSubscriptionAccess(profile.data() ?? {})) {
    throw new HttpsError('failed-precondition', 'Tu acceso está vigente. No necesitas realizar un pago.');
  }
  if (!mpAccessToken.value()) throw new HttpsError('internal', 'Configuración de pagos incompleta.');
  try {
    const client = new MercadoPagoConfig({ accessToken: mpAccessToken.value(), options: { timeout: 10_000 } });
    const result = await new Preference(client).create({ body: {
      items: [{ id: 'suscripcion_mensual', title: 'Suscripción Mensual AppGym', unit_price: MONTHLY_PRICE,
        quantity: 1, currency_id: MONTHLY_CURRENCY }],
      external_reference: request.auth.uid,
    } });
    if (!result.init_point) throw new Error('Missing checkout URL');
    return { init_point: result.init_point };
  } catch {
    logger.error('Mercado Pago checkout failed');
    throw new HttpsError('internal', 'Error generando la sesión de pago.');
  }
});

export const mercadopagoWebhook = onRequest({
  region: 'us-central1', timeoutSeconds: 30, secrets: [mpAccessToken, mpWebhookSecret],
}, async (request, response) => {
  try {
    const status = await processPaymentNotification({
      method: request.method, signature: request.headers['x-signature'], requestId: request.headers['x-request-id'],
      dataId: request.query['data.id'], bodyDataId: request.body?.data?.id,
      type: request.query.type ?? request.body?.type,
    }, {
      secret: mpWebhookSecret.value(),
      getPayment: async id => {
        if (!mpAccessToken.value()) throw new Error('Missing payment credentials');
        const client = new MercadoPagoConfig({ accessToken: mpAccessToken.value(), options: { timeout: 10_000 } });
        return new Payment(client).get({ id });
      },
      savePayment: payment => applyPayment(admin.firestore(), payment),
    });
    response.status(status).send(status === 200 ? 'OK' : 'Rejected');
  } catch {
    // Do not acknowledge failed API calls or writes; Mercado Pago must retry.
    logger.error('Mercado Pago webhook processing failed');
    response.status(500).send('Retry');
  }
});

/**
 * TRIGGER: Borrado en Cascada (Hard Delete)
 *
 * Se dispara automáticamente cuando el Super Admin elimina el documento
 * raíz de un usuario (`users/{userId}`) desde el panel de administración.
 *
 * Pasos:
 *  1. Elimina RECURSIVAMENTE el documento y todas sus subcolecciones
 *     (workouts, profile/data, etc.) mediante `recursiveDelete`.
 *  2. Elimina permanentemente al usuario de Firebase Authentication.
 */
export const cleanupUserSubcollections = onDocumentDeleted(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const uid = event.params.userId;
    const snapshot = event.data;

    logger.info(`[cleanupUserSubcollections] Iniciando borrado en cascada para UID: ${uid}`);

    // ── 1. Borrar el documento raíz + TODAS sus subcolecciones ──────────────
    if (snapshot) {
      try {
        await admin.firestore().recursiveDelete(snapshot.ref);
        logger.info(`[cleanupUserSubcollections] ✅ Subcolecciones eliminadas para UID: ${uid}`);
      } catch (firestoreError) {
        logger.error(
          `[cleanupUserSubcollections] ❌ Error fatal en recursiveDelete para UID: ${uid}`,
          firestoreError
        );
        // Re-lanzamos para que Cloud Functions marque la invocación como fallida
        throw firestoreError;
      }
    } else {
      logger.warn(
        `[cleanupUserSubcollections] Snapshot nulo para UID: ${uid}. ` +
        "El documento ya había sido eliminado antes del trigger."
      );
    }

    // ── 2. Borrar al usuario de Firebase Authentication ────────────────────
    try {
      await admin.auth().deleteUser(uid);
      logger.info(`[cleanupUserSubcollections] ✅ Usuario eliminado de Auth para UID: ${uid}`);
    } catch (authError: any) {
      if (authError?.code === "auth/user-not-found") {
        // El usuario ya fue borrado previamente de Auth — no es un error fatal.
        logger.warn(
          `[cleanupUserSubcollections] Usuario UID: ${uid} ya no existía en Auth. Se ignora.`
        );
      } else {
        // Cualquier otro error de Auth sí es relevante y debe quedar en los logs.
        logger.error(
          `[cleanupUserSubcollections] ❌ Error inesperado eliminando usuario de Auth UID: ${uid}`,
          authError
        );
      }
    }

    logger.info(`[cleanupUserSubcollections] 🏁 Proceso completado para UID: ${uid}`);
  }
);

