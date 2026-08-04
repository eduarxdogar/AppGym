# REGLAS DE ARQUITECTURA ANGULAR 17+ (FEATURE-SLICED DESIGN)
Actúa como un Arquitecto Frontend Senior. Todo el código generado o refactorizado debe cumplir estrictamente con estas reglas:

1. AISLAMIENTO POR FEATURE (Cero Espagueti):
   - Cada módulo bajo `src/app/features/` debe ser independiente.
   - Estructura obligatoria por feature: `models/` (interfaces), `services/` (API calls), `store/` (Local Signal Store), `utils/` (constantes/errores).

2. SEPARACIÓN DE RESPONSABILIDADES (El "Hook" y el "API"):
   - Los componentes (`.ts`) NO DEBEN tener lógica de negocio ni hacer llamadas directas a Firebase/HTTP.
   - Todo el estado y la lógica reactiva debe vivir en un Signal Store (`.store.ts`) provisto a nivel de componente (`providers: [FeatureStore]`).
   - Todas las llamadas a bases de datos o servicios externos deben vivir en un archivo API aislado (`.api.ts`).

3. SISTEMA DE DISEÑO (Componentes Globales y Tokens):
   - NUNCA generes HTML/CSS desde cero si existe un componente global en `src/app/core/components/` o `src/app/shared/`.
   - NUNCA uses colores quemados (ej. `#FF0000`). Utiliza SIEMPRE las variables CSS globales / Design Tokens ya definidos.

4. MANEJO DE ERRORES CENTRALIZADO:
   - Toda feature debe tener su diccionario de errores en `utils/feature.constants.ts`.
   - Los errores del API se capturan en el Store y se muestran mediante el servicio global de notificaciones (ej. ToastService).