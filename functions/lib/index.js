"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupUserSubcollections = exports.mercadopagoWebhook = exports.createCheckoutSession = exports.analyzeNutritionLabelAI = exports.analyzeInbodyAI = exports.chatAI = exports.generateBoxingPlanAI = exports.generateNutritionPlanAI = exports.generateWorkoutPlanAI = exports.callGemini = exports.initializeSubscription = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const mercadopago_1 = require("mercadopago");
const admin = require("firebase-admin");
const billing_1 = require("./billing");
const billing_store_1 = require("./billing-store");
const gemini_1 = require("./gemini");
const payment_webhook_1 = require("./payment-webhook");
const ai_orchestrator_1 = require("./ai-orchestrator");
const workout_policy_1 = require("./workout-policy");
if (!admin.apps.length)
    admin.initializeApp();
const geminiKeys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'].map(name => (0, params_1.defineSecret)(name));
const openaiKey = (0, params_1.defineSecret)('OPENAI_API_KEY');
const deepseekKey = (0, params_1.defineSecret)('DEEPSEEK_API_KEY');
const mpAccessToken = (0, params_1.defineSecret)('MP_ACCESS_TOKEN');
const mpWebhookSecret = (0, params_1.defineSecret)('MP_WEBHOOK_SECRET');
async function initializeUserBilling(uid) {
    const user = await admin.auth().getUser(uid);
    if (user.disabled)
        throw new https_1.HttpsError('permission-denied', 'La cuenta está deshabilitada.');
    await (0, billing_store_1.initializeBilling)(admin.firestore(), user.uid, Date.parse(user.metadata.creationTime), {
        email: user.email, email_verified: user.emailVerified, vip: user.customClaims?.vip,
    });
}
// Billing initialization is server-only and cannot restart a trial after profile deletion.
exports.initializeSubscription = (0, https_1.onCall)({ cors: true, region: 'us-central1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    await initializeUserBilling(request.auth.uid);
    return { initialized: true };
});
const aiOptions = {
    cors: true, region: 'us-central1', timeoutSeconds: 300,
    memory: '512MiB', maxInstances: 10, concurrency: 80, secrets: [openaiKey, deepseekKey, ...geminiKeys],
};
async function handleAi(request, defaults) {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión para usar la IA.');
    let data;
    try {
        const input = request.data;
        if (defaults && (!input || typeof input !== 'object' || Array.isArray(input)))
            throw new Error('Invalid payload');
        data = (0, gemini_1.parseGeminiPayload)(defaults ? { model: 'gemini-2.5-flash', isJson: defaults.isJson,
            ...input, ...(defaults.purpose ? { purpose: defaults.purpose, isJson: true } : {}) } : input);
        if (defaults?.mediaRequired && !data.imageBase64)
            throw new Error('Missing media');
        if (data.purpose === 'workout' && (!data.isJson || data.imageBase64))
            throw new Error('Invalid workout payload');
    }
    catch {
        throw new https_1.HttpsError('invalid-argument', 'Solicitud de IA inválida o demasiado grande.');
    }
    const profile = await admin.firestore().doc('users/' + request.auth.uid + '/profile/data').get();
    const billing = profile.data();
    if (billing?.isDeleted || !(0, billing_1.hasSubscriptionAccess)(billing ?? {})) {
        throw new https_1.HttpsError('permission-denied', 'La suscripción o el período de prueba no están vigentes.');
    }
    if (data.useSeelegSupplements === true) {
        data = { ...data, prompt: data.prompt + '\nINTEGRACIÓN SEELEG (activada por el usuario): Genera exactamente UNA comida (Snack o Post-Entreno) como una preparación detallada con suplementos Seeleg. Solo esa comida debe incluir isSponsored: true y sponsorBrand: "Seeleg" en el JSON. El resto de comidas no deben incluir esos campos.' };
    }
    try {
        let context = { isJson: data.isJson, history: data.history, model: data.model,
            systemInstruction: defaults?.systemInstruction };
        if (data.purpose === 'workout' && (0, workout_policy_1.isBodyweightProfile)(billing ?? {})) {
            const db = admin.firestore();
            const snapshots = await Promise.all([
                db.collection('global_exercises').where('equipment', '==', 'body only').get(),
                db.collection('global_exercises').where('equipmentRequired', 'array-contains', 'Calistenia').get(),
            ]);
            const catalog = new Map();
            for (const snapshot of snapshots)
                for (const doc of snapshot.docs)
                    catalog.set(doc.id, { ...doc.data(), id: doc.id });
            const policy = (0, workout_policy_1.bodyweightPolicy)([...catalog.values()]);
            context = { ...context, ...policy,
                systemInstruction: [context.systemInstruction, policy.systemInstruction].filter(Boolean).join('\n') };
        }
        if (data.imageBase64) {
            return { text: await (0, gemini_1.generateWithFallback)({ ...data,
                    prompt: [context.systemInstruction, data.prompt].filter(Boolean).join('\n') }, geminiKeys.map(key => key.value())) };
        }
        return { text: await (0, ai_orchestrator_1.orchestrateAi)(data.prompt, context, { keys: {
                    openai: openaiKey.value(), deepseek: deepseekKey.value(), gemini: geminiKeys.map(key => key.value()),
                } }) };
    }
    catch (error) {
        const status = error instanceof gemini_1.GeminiError || error instanceof ai_orchestrator_1.AiUnavailableError ? error.status : 500;
        logger.warn('AI request failed', { status });
        throw new https_1.HttpsError(status === 429 ? 'resource-exhausted' : status === 504 ? 'deadline-exceeded'
            : status === 503 ? 'unavailable' : 'internal', 'No fue posible completar la solicitud de IA.', { providerAttemptsComplete: true });
    }
}
// Preserve existing callable names/contracts, including deployed legacy clients.
exports.callGemini = (0, https_1.onCall)(aiOptions, request => handleAi(request));
exports.generateWorkoutPlanAI = (0, https_1.onCall)(aiOptions, request => handleAi(request, {
    isJson: true, purpose: 'workout', systemInstruction: 'Eres COACH TRÍADA. Genera rutinas seguras según nivel, objetivo, disponibilidad y fatiga. Respeta exactamente el esquema Workout solicitado.',
}));
exports.generateNutritionPlanAI = (0, https_1.onCall)(aiOptions, request => handleAi(request, {
    isJson: true, systemInstruction: 'Eres un nutricionista deportivo. Respeta el esquema JSON solicitado y los datos del usuario.',
}));
exports.generateBoxingPlanAI = (0, https_1.onCall)(aiOptions, request => handleAi(request, {
    isJson: true, systemInstruction: 'Eres un entrenador de boxeo. Genera un plan seguro con el esquema JSON solicitado.',
}));
exports.chatAI = (0, https_1.onCall)(aiOptions, request => handleAi(request, { isJson: false,
    systemInstruction: 'Eres COACH TRÍADA. Responde en español sobre entrenamiento y nutrición, considerando el contexto y la fatiga del usuario.',
}));
exports.analyzeInbodyAI = (0, https_1.onCall)(aiOptions, request => handleAi(request, { isJson: true, mediaRequired: true,
    systemInstruction: 'Extrae únicamente mediciones visibles del informe InBody. Usa null para valores ausentes, nunca inventes resultados.',
}));
exports.analyzeNutritionLabelAI = (0, https_1.onCall)(aiOptions, request => handleAi(request, { isJson: true, mediaRequired: true,
    systemInstruction: 'Extrae valores por porción (por 100g si no hay porción). Devuelve JSON con calories, protein, carbs y fats numéricos; no inventes mediciones.',
}));
exports.createCheckoutSession = (0, https_1.onCall)({
    cors: true, region: 'us-central1', secrets: [mpAccessToken],
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión para pagar.');
    // A direct request or a login race must not charge a user whose trial is not initialized yet.
    await initializeUserBilling(request.auth.uid);
    const profile = await admin.firestore().doc('users/' + request.auth.uid + '/profile/data').get();
    if (profile.get('isDeleted'))
        throw new https_1.HttpsError('permission-denied', 'La cuenta no está disponible.');
    if ((0, billing_1.hasSubscriptionAccess)(profile.data() ?? {})) {
        throw new https_1.HttpsError('failed-precondition', 'Tu acceso está vigente. No necesitas realizar un pago.');
    }
    if (!mpAccessToken.value())
        throw new https_1.HttpsError('internal', 'Configuración de pagos incompleta.');
    try {
        const client = new mercadopago_1.MercadoPagoConfig({ accessToken: mpAccessToken.value(), options: { timeout: 10_000 } });
        const result = await new mercadopago_1.Preference(client).create({ body: {
                items: [{ id: 'suscripcion_mensual', title: 'Suscripción Mensual AppGym', unit_price: billing_1.MONTHLY_PRICE,
                        quantity: 1, currency_id: billing_1.MONTHLY_CURRENCY }],
                external_reference: request.auth.uid,
            } });
        if (!result.init_point)
            throw new Error('Missing checkout URL');
        return { init_point: result.init_point };
    }
    catch {
        logger.error('Mercado Pago checkout failed');
        throw new https_1.HttpsError('internal', 'Error generando la sesión de pago.');
    }
});
exports.mercadopagoWebhook = (0, https_1.onRequest)({
    region: 'us-central1', timeoutSeconds: 30, secrets: [mpAccessToken, mpWebhookSecret],
}, async (request, response) => {
    try {
        const status = await (0, payment_webhook_1.processPaymentNotification)({
            method: request.method, signature: request.headers['x-signature'], requestId: request.headers['x-request-id'],
            dataId: request.query['data.id'], bodyDataId: request.body?.data?.id,
            type: request.query.type ?? request.body?.type,
        }, {
            secret: mpWebhookSecret.value(),
            getPayment: async (id) => {
                if (!mpAccessToken.value())
                    throw new Error('Missing payment credentials');
                const client = new mercadopago_1.MercadoPagoConfig({ accessToken: mpAccessToken.value(), options: { timeout: 10_000 } });
                return new mercadopago_1.Payment(client).get({ id });
            },
            savePayment: payment => (0, billing_store_1.applyPayment)(admin.firestore(), payment),
        });
        response.status(status).send(status === 200 ? 'OK' : 'Rejected');
    }
    catch {
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
exports.cleanupUserSubcollections = (0, firestore_1.onDocumentDeleted)({
    document: "users/{userId}",
    region: "us-central1",
}, async (event) => {
    const uid = event.params.userId;
    const snapshot = event.data;
    logger.info(`[cleanupUserSubcollections] Iniciando borrado en cascada para UID: ${uid}`);
    // ── 1. Borrar el documento raíz + TODAS sus subcolecciones ──────────────
    if (snapshot) {
        try {
            await admin.firestore().recursiveDelete(snapshot.ref);
            logger.info(`[cleanupUserSubcollections] ✅ Subcolecciones eliminadas para UID: ${uid}`);
        }
        catch (firestoreError) {
            logger.error(`[cleanupUserSubcollections] ❌ Error fatal en recursiveDelete para UID: ${uid}`, firestoreError);
            // Re-lanzamos para que Cloud Functions marque la invocación como fallida
            throw firestoreError;
        }
    }
    else {
        logger.warn(`[cleanupUserSubcollections] Snapshot nulo para UID: ${uid}. ` +
            "El documento ya había sido eliminado antes del trigger.");
    }
    // ── 2. Borrar al usuario de Firebase Authentication ────────────────────
    try {
        await admin.auth().deleteUser(uid);
        logger.info(`[cleanupUserSubcollections] ✅ Usuario eliminado de Auth para UID: ${uid}`);
    }
    catch (authError) {
        if (authError?.code === "auth/user-not-found") {
            // El usuario ya fue borrado previamente de Auth — no es un error fatal.
            logger.warn(`[cleanupUserSubcollections] Usuario UID: ${uid} ya no existía en Auth. Se ignora.`);
        }
        else {
            // Cualquier otro error de Auth sí es relevante y debe quedar en los logs.
            logger.error(`[cleanupUserSubcollections] ❌ Error inesperado eliminando usuario de Auth UID: ${uid}`, authError);
        }
    }
    logger.info(`[cleanupUserSubcollections] 🏁 Proceso completado para UID: ${uid}`);
});
//# sourceMappingURL=index.js.map