# Administradores y VIP vitalicio

`setup-admins.js` busca exclusivamente `cristiangarzon1231@gmail.com` y `Julli1230@gmail.com` en Firebase Auth del proyecto `appgym-d8061`.

- Agrega los custom claims booleanos `admin: true` y `vip: true`, conservando los claims previos.
- Guarda en `users/{uid}`: `role: 'admin'`, `subscriptionStatus: 'active'`, `isVip: true` y `trialEndsAt: null`.
- Guarda en el perfil real de AppGym, `users/{uid}/profile/data`, `subscriptionStatus: 'vip'`, `trialEndsAt: null` y `expiresAt: null`. El estado `vip` es el contrato de acceso vitalicio de la app; un perfil `active` sin una fecha futura no concedería acceso.
- Las dos escrituras Firestore se realizan en una transacción. Firebase Auth es un servicio separado; una ejecución posterior completa cualquier operación que haya fallado después de asignar los claims.
- No reemplaza el perfil de entrenamiento, no marca el onboarding como completado y no reactiva cuentas deshabilitadas o eliminadas.
- Si falta un correo en Auth, indica que debe registrarse primero, continúa con la otra cuenta y termina con código de salida distinto de cero para informar la configuración incompleta.
- Verifica por lectura los claims y los campos escritos.

Ambos scripts reutilizan el Admin SDK instalado en `functions/node_modules` y leen las credenciales mediante `GOOGLE_APPLICATION_CREDENTIALS`. El archivo JSON de credenciales se mantiene fuera del repositorio.

Ejecutar la preparación de ambas cuentas y la importación del catálogo visible:

```powershell
Set-Location "C:\AppGym"
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Credenciales\appgym-admin.json"
if (-not (Test-Path -LiteralPath $env:GOOGLE_APPLICATION_CREDENTIALS -PathType Leaf)) {
    throw "No se encontró el JSON de credenciales."
}

node scripts/setup-admins.js
if ($LASTEXITCODE -ne 0) { throw "La configuración de administradores quedó incompleta; revisa el mensaje anterior." }

node scripts/import-exercises.js --collection global_exercises
if ($LASTEXITCODE -ne 0) { throw "La importación se interrumpió; corrige el error y repite este bloque." }
```

Si faltan dependencias, primero ejecuta `npm.cmd ci --prefix functions`. Para actualizar los claims de una sesión que ya estaba abierta, cierra sesión en AppGym y vuelve a ingresar.

La decisión del menú y del guard de administración utiliza el token firmado de Firebase. Las reglas Firestore aceptan el claim `admin` y mantienen protegidos los campos de rol y facturación frente a escrituras del cliente. La inicialización de la suscripción obtiene el claim VIP desde Admin Auth, sin confiar en datos enviados por el cliente.
