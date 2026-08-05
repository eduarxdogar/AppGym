"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupUserSubcollections = exports.mercadopagoWebhook = exports.createCheckoutSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const mercadopago_1 = require("mercadopago");
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
__exportStar(require("./ai"), exports);
exports.createCheckoutSession = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado para crear una sesión de pago.");
    }
    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
        logger.error("No se encontró MP_ACCESS_TOKEN en el entorno.");
        throw new https_1.HttpsError("internal", "Configuración de servidor incompleta.");
    }
    try {
        const client = new mercadopago_1.MercadoPagoConfig({ accessToken: mpAccessToken });
        const preference = new mercadopago_1.Preference(client);
        const result = await preference.create({
            body: {
                items: [
                    {
                        id: "suscripcion_mensual",
                        title: "Suscripción Mensual AppGym",
                        unit_price: 30000,
                        quantity: 1,
                        currency_id: "COP"
                    }
                ],
                external_reference: request.auth.uid
            }
        });
        return { init_point: result.init_point };
    }
    catch (error) {
        logger.error("Error creando sesión de MercadoPago:", error);
        throw new https_1.HttpsError("internal", "Error generando la sesión de pago.");
    }
});
exports.mercadopagoWebhook = (0, https_1.onRequest)({ cors: true }, async (request, response) => {
    const type = request.query.type || request.body.type;
    const dataId = request.query['data.id'] || request.body.data?.id;
    if (type === 'payment' && dataId) {
        const mpAccessToken = process.env.MP_ACCESS_TOKEN;
        if (mpAccessToken) {
            try {
                const client = new mercadopago_1.MercadoPagoConfig({ accessToken: mpAccessToken });
                const payment = new mercadopago_1.Payment(client);
                const paymentInfo = await payment.get({ id: dataId });
                if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
                    const uid = paymentInfo.external_reference;
                    // Use merge:true for idempotence and safety
                    await admin.firestore().doc(`users/${uid}/profile/data`).set({
                        subscriptionStatus: 'active',
                        trialEndsAt: null
                    }, { merge: true });
                }
            }
            catch (err) {
                logger.error('Error procesando webhook MP', err);
            }
        }
    }
    // Always return 200 OK fast so MercadoPago doesn't retry
    response.status(200).send('OK');
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