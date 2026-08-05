import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export * from './ai';

export const createCheckoutSession = onCall({
  cors: true,
  region: 'us-central1'
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado para crear una sesión de pago."
    );
  }

  const mpAccessToken = process.env.MP_ACCESS_TOKEN;
  if (!mpAccessToken) {
    logger.error("No se encontró MP_ACCESS_TOKEN en el entorno.");
    throw new HttpsError(
      "internal",
      "Configuración de servidor incompleta."
    );
  }

  try {
    const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const preference = new Preference(client);

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
  } catch (error: any) {
    logger.error("Error creando sesión de MercadoPago:", error);
    throw new HttpsError("internal", "Error generando la sesión de pago.");
  }
});

export const mercadopagoWebhook = onRequest({ cors: true }, async (request, response) => {
  const type = request.query.type || request.body.type;
  const dataId = request.query['data.id'] || request.body.data?.id;

  if (type === 'payment' && dataId) {
    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (mpAccessToken) {
      try {
        const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: dataId as string });
        
        if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
          const uid = paymentInfo.external_reference;
          // Use merge:true for idempotence and safety
          await admin.firestore().doc(`users/${uid}/profile/data`).set({
            subscriptionStatus: 'active',
            trialEndsAt: null
          }, { merge: true });
        }
      } catch (err) {
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

