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

