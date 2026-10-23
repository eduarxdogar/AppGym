# FitnessApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

# Guía rápida para configurar Husky + Lint-Staged en este proyecto

Este archivo describe cómo se configuró **Husky** y **lint-staged** para ejecutar `eslint` y `prettier` automáticamente antes de hacer un commit.

---

## ✅ Requisitos previos

Asegurate de tener Node.js y Git instalados.

---

## ⚙️ Instalación de dependencias

```bash
npm install --save-dev husky lint-staged
```

---

## 🔧 Configurar Husky

### 1. Añadir el script `prepare` en package.json

```bash
npm pkg set scripts.prepare="husky install"
```

### 2. Ejecutar el script de instalación

```bash
npm run prepare
```

Este comando inicializa Husky y crea la carpeta `.husky/` en el proyecto.

---

## ✏️ Crear el hook `pre-commit`

```bash
npx husky add .husky/pre-commit "npx lint-staged"
```

Este comando crea automáticamente el archivo `.husky/pre-commit` con el siguiente contenido:

```sh
#!/usr/bin/env sh
. "$(dirname "$0")/h"

npx lint-staged
```

> ⚠️ ¡No modificar la ruta del `husky.sh` manualmente! La que genera Husky por defecto (`h`) es válida y funciona correctamente.

---

## 🎯 Configurar lint-staged

Agregar esta sección en tu `package.json`:

```json
"lint-staged": {
  "*.{ts,js,tsx,jsx}": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

Esto asegura que antes de cada commit se corran automáticamente `eslint` y `prettier` solo sobre los archivos modificados.

---

## ✅ Prueba final

```bash
git add <archivo>
git commit -m "Probando husky y lint-staged"
```

Si todo está bien, se debería ejecutar lint-staged y luego permitir el commit.

---

## 🧠 Notas

- Husky genera por defecto varios hooks. No es necesario modificarlos manualmente.
- Si ves el error `No such file or directory`, probablemente editaste incorrectamente la ruta del `husky.sh`.

## Husky Hooks Configurados

### pre-commit
Corre `npx lint-staged` antes de cada commit, para formatear y hacer lint de archivos modificados.

### pre-push (pendiente de configurar)
Podríamos usarlo para correr `npm test` y asegurar que no se sube código roto.

### Otros hooks disponibles en `.husky/`
- `commit-msg`
- `post-merge`
- `prepare-commit-msg`
- Todos vacíos por ahora, se pueden personalizar según necesidades.


## Seguridad: suscripciones, pagos e IA

Las pruebas de seguridad usan exclusivamente el proyecto ficticio demo-appgym-security y el emulador local (Java requerido). No utilizan credenciales de producción:

```bash
npm run test:backend
npm run test:rules
```

Antes del despliegue, configurar en Firebase Secret Manager los cinco secretos GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET, usando `firebase functions:secrets:set NOMBRE`. El último es la clave secreta de firma de Webhooks de la aplicación de Mercado Pago; no es su access token. No colocar estos valores en Angular ni en Git. Para el emulador de Functions usar functions/.secret.local, ignorado por Git.

Si esas variables ya existen como variables de entorno normales en `.env` o Cloud Run, migrarlas a Secret Manager y retirar los nombres duplicados antes del despliegue. La validación sigue el esquema de [Webhooks de Mercado Pago](https://www.mercadopago.com.co/developers/en/docs/checkout-pro-preferences/additional-content/notifications/webhooks).

La rotación de Gemini se ejecuta en el servidor: hasta tres claves distintas, 80 segundos máximos por intento, espera de 250/500 ms y únicamente errores transitorios (408/429/5xx o fallo de red). Las claves de un mismo proyecto pueden compartir cuota. El cliente no repite una rotación ya agotada. El servidor verifica suscripción o trial vigente antes de llamar a Gemini.

En Mercado Pago configurar notificaciones Webhooks del tipo payment a la URL desplegada de mercadopagoWebhook (us-central1). Se exige POST, data.id en la query, x-request-id y firma HMAC válida con tolerancia de cinco minutos. Se consulta el pago mediante la API autenticada; el cuerpo del webhook no decide el estado. El importe mensual permanece en 30000 COP. expiresAt es date_approved + 30 días, sin sumar otros 30 días por cada entrega repetida. Cancelaciones, reembolsos (también parciales) y contracargos revocan el pago correspondiente. Los fallos de API/Firestore responden 500 para permitir reintentos.

Desplegar Functions y el cliente actualizado antes de activar las nuevas reglas: los clientes anteriores intentan escribir el trial y serán rechazados. initializeSubscription crea el trial en una transacción y conserva un marcador privado en billing_accounts para que borrar el perfil no reinicie sus siete días. La interfaz escucha cambios del perfil, por lo que un pago o reembolso se refleja sin volver a iniciar sesión.

Antes del cambio de producción, revisar los perfiles históricos con subscriptionStatus=active sin expiresAt: conciliar cada pago con Mercado Pago y completar sus fechas e identificadores desde un proceso administrativo de servidor. El código anterior concedía acceso indefinido y no guardaba un identificador de pago; estos perfiles no se consideran vigentes sin una fecha verificable. No inferir pagos válidos a partir del estado histórico editable por el cliente.

Las pruebas de regresión comprueban lecturas del propietario, catálogos, consultas globales del Admin y escrituras atómicas de entrenamientos. La cuenta Admin requiere email verificado y también está sujeta a la inmutabilidad de facturación y userId. En users/{uid}/profile/data la identidad es el documento padre users/{uid}, no el id data ni un campo uid del perfil.

## Entrada de datos y contexto de Coach AI

El onboarding requiere onboardingCompleted=true, peso finito mayor que cero, objetivo y nivel válidos y al menos un día de la semana disponible (sin duplicados). Un documento creado solo para el trial no completa el perfil. Los perfiles históricos sin el flag deben volver a confirmar el onboarding; no se marca su finalización automáticamente. Las rutas de generación también usan profileGuard.

La respuesta de InBody pasa por un esquema Zod estricto: valores numéricos finitos, porcentajes entre 0 y 100, campos segmentales tipados y segmentos ausentes normalizados a null. Un JSON vacío, ilegible o malformado muestra un mensaje y no sustituye un reporte anterior válido. Se impide guardar mientras se escanea y se eliminan propiedades undefined antes de escribir perfiles en Firestore.

callGemini exige una suscripción pagada o trial vigente para todas las cuentas, incluyendo Admin. Valida el payload antes de consultar Firestore y limita el prompt a 64 KiB UTF-8, el historial a 128 KiB y el texto combinado a 160 KiB (máximo 100 mensajes y 20 partes por mensaje). Los adjuntos aceptan JPEG, PNG, WebP o PDF; el cliente limita el archivo a 7,5 MB y el servidor valida formato Base64 y tamaño. Las pruebas de emulador simulan Gemini: no generan tráfico ni cargos reales de IA.

TrainerAiService obtiene la recuperación actual de RecoveryService y convierte una sola vez a fatiga: fatiga = 100 - recuperación. Los porcentajes guardados en perfiles antiguos se ignoran como contexto de planificación. Así, recuperación 100% representa fatiga 0%, tanto para una rutina como para un plan semanal.
