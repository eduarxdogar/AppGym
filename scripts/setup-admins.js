'use strict';

const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs/promises');

const PROJECT_ID = 'appgym-d8061';
const ADMIN_EMAILS = ['cristiangarzon1231@gmail.com', 'Julli1230@gmail.com'];
const USER_FIELDS = Object.freeze({ role: 'admin', subscriptionStatus: 'active', trialEndsAt: null, isVip: true });
// This is the actual lifetime subscription contract consumed by Angular and Functions.
// An 'active' profile without a future expiresAt does NOT grant access in AppGym.
const PROFILE_FIELDS = Object.freeze({ subscriptionStatus: 'vip', trialEndsAt: null, expiresAt: null });

async function setupAdmin(auth, db, user, log = console.log) {
  log(`[OK] Usuario encontrado: ${user.email} (${user.uid}).`);
  if (user.disabled) throw new Error('La cuenta está deshabilitada; no se modificó.');

  const userRef = db.doc(`users/${user.uid}`);
  const profileRef = db.doc(`users/${user.uid}/profile/data`);
  // Check before granting a claim; never silently reactivate a deleted account.
  const profile = await profileRef.get();
  if (profile.get('isDeleted') === true) throw new Error('El perfil está eliminado; no se modificó.');

  if (user.customClaims?.admin !== true || user.customClaims?.vip !== true) {
    // setCustomUserClaims replaces the entire map: preserve unrelated permissions.
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true, vip: true });
    log(`[OK] Claims admin: true y vip: true asignados a ${user.email}.`);
  } else {
    log(`[OK] ${user.email} ya tiene los claims admin: true y vip: true.`);
  }

  // Both Firestore documents commit together. Auth and Firestore are separate
  // services: if this transaction fails, rerun the script to finish the grant.
  await db.runTransaction(async transaction => {
    const currentProfile = await transaction.get(profileRef);
    if (currentProfile.get('isDeleted') === true) throw new Error('El perfil está eliminado.');
    transaction.set(userRef, USER_FIELDS, { merge: true });
    transaction.set(profileRef, PROFILE_FIELDS, { merge: true });
  });
  log(`[OK] users/${user.uid}: role: admin, active, trialEndsAt: null, isVip: true.`);
  log(`[OK] users/${user.uid}/profile/data: VIP vitalicio, sin vencimiento.`);

  const [verifiedUser, verifiedRoot, verifiedProfile] = await Promise.all([
    auth.getUser(user.uid), userRef.get(), profileRef.get(),
  ]);
  const fieldsMatch = (snapshot, fields) => Object.entries(fields)
    .every(([key, value]) => snapshot.get(key) === value);
  if (verifiedUser.customClaims?.admin !== true || verifiedUser.customClaims?.vip !== true || !fieldsMatch(verifiedRoot, USER_FIELDS)
      || !fieldsMatch(verifiedProfile, PROFILE_FIELDS)) {
    throw new Error('La verificación final no coincide con los valores esperados.');
  }
  log(`[OK] Claim y suscripción verificados para ${user.email}.`);
}

async function setupAccounts(auth, db, emails = ADMIN_EMAILS, log = console.log, errorLog = console.error) {
  let failures = 0;
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email.toLowerCase());
      await setupAdmin(auth, db, user, log);
    } catch (error) {
      failures++;
      if (error.code === 'auth/user-not-found') {
        errorLog(`[PENDIENTE] ${email} no existe en Firebase Auth. Debe registrarse primero en AppGym; después repite este script.`);
      } else {
        errorLog(`[ERROR] ${email}: ${error.message} ${error.code ? `(${error.code})` : ''}`);
      }
    }
  }
  return { configured: emails.length - failures, failures };
}

async function main() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) throw new Error('Define GOOGLE_APPLICATION_CREDENTIALS con la ruta del JSON de cuenta de servicio.');
  try { await fs.access(credentialsPath); }
  catch { throw new Error(`No se puede leer el archivo de credenciales: ${credentialsPath}. Comprueba la ruta y la extensión .json.`); }
  // Reuse the Admin SDK already declared in functions/package.json. No browser
  // Firebase config, API keys or downloaded service-account keys belong here.
  const requireFunctions = createRequire(path.join(__dirname, '../functions/package.json'));
  const admin = requireFunctions('firebase-admin');
  const app = admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID }, 'setup-admins');
  try {
    const auth = admin.auth(app);
    const db = admin.firestore(app);
    console.log(`Proyecto: ${PROJECT_ID}. Se configurarán ${ADMIN_EMAILS.length} cuentas existentes.`);
    const { failures } = await setupAccounts(auth, db);
    if (failures) throw new Error(`${failures} cuenta(s) incompleta(s). Corrige el error y vuelve a ejecutar el script.`);
    console.log('[OK] Ambas cuentas configuradas. Cierra sesión y vuelve a ingresar para renovar el token.');
  } finally {
    await app.delete();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[ERROR] ${error.message} ${error.code ? `(${error.code})` : ''}`);
    process.exitCode = 1;
  });
}

module.exports = { setupAdmin, setupAccounts };
