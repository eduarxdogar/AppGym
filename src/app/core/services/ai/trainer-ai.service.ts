import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { ToastService } from '../toast.service';
import { Workout } from '../../models/workout.model';
import { UserProfile } from '../../models/user-profile.model';
import { WeeklyPlanRequest } from '../../models/ai-requests.model';
import { WorkoutSchema } from '../../models/workout/schemas/workout.schema';
import { z } from 'zod';
import { RecoveryService } from '../recovery.service';
import { profileEquipment } from '../../models/equipment';

const SYSTEM_PROMPT = `
Eres COACH TRÍADA, un Entrenador Élite de Culturismo y Powerbuilding (IFBB Pro Persona). 
Tu enfoque es duro, científico y orientado 100% a la hipertrofia y fuerza máxima. ODIAS el entrenamiento suave, el yoga o la 'recuperación activa' para clientes Avanzados. Hablas en términos de RIR, RPE, Top Sets, Drop Sets y Frecuencia.

PERSONALIDAD:
- Eres apasionado, enérgico y empujás al atleta a dar lo mejor de sí mismo.
- Usas expresiones naturales de gimnasio: "eso es", "venga pues", "no te achantes", "dale con todo", "sangre y fuego".
- Eres directo: si algo no funciona, lo dices claramente. Si un músculo está reventado, mandas a descansar sin drama, pero bajo protocolos de culturismo profesional.
- NUNCA dices "como modelo de lenguaje", "mi red neuronal", "como IA" ni frases similares. Eres un profe de la vieja escuela con ciencia moderna.

NOMENCLATURA OBLIGATORIA DE SPLITS (REGLA MÁS IMPORTANTE):
- REGLA DE ORO: Si el usuario es nivel 'Avanzado', ESTÁ ESTRICTAMENTE PROHIBIDO usar palabras como 'Recuperación', 'Suave', 'Flujo', 'Movilidad', 'Activación' en los títulos de rutinas de hipertrofia. DEBES usar nomenclatura de culturismo/powerbuilding puro.
- USA SIEMPRE nomenclatura profesional de hipertrofia/fuerza.

EJEMPLO ESTRICTO DE NOMENCLATURA PARA AVANZADO (6 DÍAS, VOLUMEN):
Si el usuario entrena 6 días, DEBES usar un split Push/Pull/Legs Frecuencia 2 con estos títulos EXACTOS o muy similares:
- Día 1: Push F1 (Fuerza y Densidad)
- Día 2: Pull F1 (Espesor y Amplitud)
- Día 3: Legs F1 (Énfasis Cuádriceps)
- Día 4: Push F2 (Hipertrofia)
- Día 5: Pull F2 (Detalles y Trapecios)
- Día 6: Legs F2 (Énfasis Isquios y Glúteos)

REGLAS DE PROGRAMACIÓN POR NIVEL:
1. Principiante: Aprendizaje motor primero. Máquinas guiadas, técnica básica impecable, 2-3 series, full-body o torso/pierna, 10-15 reps dejando RIR 2-3 siempre.
2. Intermedio: Pesos libres compuestos, gestión RPE/RIR estricta, splits Push/Pull/Legs o Upper/Lower, 3-4 series con sobrecarga progresiva real.
3. Avanzado (NIVEL ELITE): Técnicas de intensidad avanzadas obligatorias. ES OBLIGATORIO incluir en las notas de CADA ejercicio:
   - RIR (Reps in Reserve) objetivo para cada serie.
   - Top Sets + Back-off Sets (ej: "1 Top Set pesado al fallo técnico, luego 3 Back-off sets al 80%")
   - Rest-Pause o Myo-reps para ejercicios de aislamiento
   - Superseries agonista-antagonista (ej: Press + Remo) para densidad
   - Drop sets en el último set de ejercicios de aislamiento
   - Instrucciones exactas de tempo (ej: 3-0-1-0)

REGLAS DE ORO INTRANSABLES:
1. BIOMECÁNICA PRIMERO: Siempre la seguridad articular y el torque en el músculo objetivo sobre el ego del peso.
2. GESTIÓN DE FATIGA: Si un músculo está fatigado (>70%), PROHIBIDO entrenarlo pesado. Se trabajan antagonistas o se prescribe descanso activo estilo culturista.
3. COHESIÓN SEMANAL: Distribuye el volumen total de forma inteligente para evitar sobreentrenamiento y maximizar la supercompensación.
`;

@Injectable({
  providedIn: 'root'
})
export class TrainerAiService {
  private readonly baseAi = inject(BaseAiService);
  private readonly recovery = inject(RecoveryService);
  private readonly toastService = inject(ToastService);
  public activeModel = this.baseAi.activeModel;

  async generateWorkout(userPrompt: string, userProfile: UserProfile): Promise<Workout> {
    if (!this.baseAi.isConfigured) {
        return this.getFallbackWorkout(userProfile);
    }

    console.log('AI Coach: Generating single workout...', { userPrompt });

    const prompt = this.buildPrompt(userPrompt, userProfile);
    
    try {
        const text = await this.baseAi.generateWorkoutContent(prompt);
        const cleanText = this.baseAi.cleanJson(text);
        const parsedData = JSON.parse(cleanText);
        
        const validation = WorkoutSchema.safeParse({
            ...parsedData,
            id: crypto.randomUUID(),
            fecha: new Date().toISOString(),
            ejercicios: parsedData.ejercicios || []
        });

        if (!validation.success) {
            console.error('Zod validation failed for Workout:', validation.error);
            this.toastService.showError('La IA generó una rutina inválida. Intenta nuevamente.');
            throw new Error('Invalid JSON structure returned by AI');
        }
        
        return validation.data;
    } catch (error: unknown) {
        console.error('Error generating workout:', error);
        throw error;
    }
  }

  async generateWeeklyPlan(request: WeeklyPlanRequest): Promise<Workout[]> {
    if (!this.baseAi.isConfigured) {
        return [];
    }

    console.log('AI Coach: Generating weekly plan...', request);

    try {
      if (!Number.isInteger(request.daysToGenerate) || request.daysToGenerate < 1 || request.daysToGenerate > 7) {
        throw new Error('El plan debe tener entre uno y siete días.');
      }
      // A whole week can exceed the provider's ten-second deadline. Generate bounded
      // daily responses, preserve their order and expose no partial plan on failure.
      const split = request.daysToGenerate === 4 ? ['Torso A', 'Pierna A', 'Torso B', 'Pierna B']
        : request.daysToGenerate === 5 ? ['Push', 'Pull', 'Legs', 'Torso', 'Pierna']
        : request.daysToGenerate <= 2 ? ['Full Body A', 'Full Body B']
        : Array.from({ length: request.daysToGenerate }, (_, i) => ['Push', 'Pull', 'Legs'][i % 3] + (i < 3 ? ' F1' : ' F2'));
      const parsedData = await Promise.all(Array.from({ length: request.daysToGenerate }, async (_, index) => {
        const prompt = this.buildPrompt(request.userPrompt, request.profile)
          + `\nCOORDINACIÓN SEMANAL: Día ${index + 1} de ${request.daysToGenerate}. Distribución: ${split.join(', ')}.
En esta respuesta genera SOLO el día ${index + 1}, enfoque ${split[index]}, como UN objeto Workout.
La fatiga y el equipo tienen prioridad sobre el split. Usa 4-6 ejercicios adecuados al nivel y notas concisas
(máximo 60 caracteres por ejercicio). No repitas la semana completa ni añadas explicaciones fuera del JSON.`;
        const text = await this.baseAi.generateWorkoutContent(prompt);
        return JSON.parse(this.baseAi.cleanJson(text)) as unknown;
      }));
      const workoutAiSchema = WorkoutSchema.omit({ id: true, fecha: true });
      const validation = z.array(workoutAiSchema).safeParse(parsedData);

      if (!validation.success) {
         console.error('Zod validation failed for Weekly Plan:', validation.error);
         this.toastService.showError('La IA devolvió datos semanales malformados. Intenta de nuevo.');
         throw new TypeError('AI did not return a valid array of workouts');
      }

      const cursor = new Date();
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const availableDays = new Set((request.profile.availableDays ?? []).filter(day => dayNames.includes(day)));

      return validation.data.map(data => {
         while (availableDays.size > 0 && !availableDays.has(dayNames[cursor.getDay()])) {
           cursor.setDate(cursor.getDate() + 1);
         }
         const workoutDate = new Date(cursor);
         cursor.setDate(cursor.getDate() + 1);

         return {
            ...data,
            id: crypto.randomUUID(),
            fecha: workoutDate.toISOString(),
            ejercicios: data.ejercicios || []
         } as Workout;
      });

    } catch (error: unknown) {
      console.error('Error generating weekly plan:', error);
      throw error;
    }
  }

  private buildPrompt(userPrompt: string, profile: UserProfile): string {
    // RecoveryService.percentage means recovery. Convert at this single boundary
    // rather than trusting legacy profile.fatigueLevels populated by callers.
    const fatigueLevels = Object.fromEntries(Array.from(this.recovery.muscleRecoveryStatus(), ([muscle, status]) =>
      [muscle, Math.max(0, Math.min(100, 100 - status.percentage))]));

    const now = new Date();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const currentDayName = days[now.getDay()];
    const formattedDate = now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

    return `
      ${SYSTEM_PROMPT}
      
      CONTEXTO DEL USUARIO:
      - Fecha Actual: Hoy es ${currentDayName}, ${formattedDate}.
      - Objetivo: ${profile.goal || 'volumen'}
      - Nivel Fitness: ${profile.fitnessLevel || 'Intermedio'}
      - Equipamiento: ${profileEquipment(profile).join(', ')}
      ${profileEquipment(profile).includes('BODYWEIGHT') ? '- PRIORIDAD DE EQUIPO: SOLO calistenia de peso corporal del catálogo del servidor. pesokg: 0. Sin máquinas, pesas ni dropsets. Adapta repeticiones, tempo y técnica al nivel.' : ''}
      - Días disponibles (Cronológico): ${profile.availableDays?.join(', ') || 'Cualquiera'}
      - Fatiga Muscular Reciente (0% = sin fatiga; 100% = fatiga máxima): ${JSON.stringify(fatigueLevels)}
      - Ajusta la carga al estado real: prioriza músculos con baja fatiga y evita sobrecargar los de alta fatiga.
      - Solicitud específica del usuario: "${userPrompt}"

      TAREA: Genera una rutina única. Usa notas concisas y conserva los campos requeridos.

      REGLA DE ORO: Debes responder EXCLUSIVAMENTE con un JSON válido. No incluyas markdown, solo el JSON raw.
      Tu respuesta debe ser: UN SOLO objeto JSON (Workout).

      ESTRUCTURA JSON DE UN WORKOUT (Interface Workout):
      {
        "nombre": "string (OBLIGATORIO: Para nivel avanzado usar solo nomenclatura técnica: Push F1, Pull F2, Legs, etc. PROHIBIDO: Suave, Flujo, Reactivación)",
        "nivelDificultad": "principiante" | "intermedio" | "avanzado",
        "musculos": ["string" (Lista de grupos musculares principales)],
        "ejercicios": [
          {
            "id": number (1, 2, 3...),
            "nombre": "string",
            "grupoMuscular": "string",
            "tipo": "compuesto" | "aislado",
            "series": number,
            "repeticiones": number,
            "descanso": "string (ej: '90s')",
            "pesokg": number (Estimado para el nivel ${profile.fitnessLevel}),
            "rir": number (OBLIGATORIO para avanzado: Indicar RPE/RIR objetivo),
            "notas": "string (Instrucciones de nivel ELITE: Top Sets, Back-offs, Tempo 3-0-1-0)"
          }
        ]
      }
    `;
  }

   private getFallbackWorkout(userProfile: UserProfile): Workout {
       return {
           id: crypto.randomUUID(),
           nombre: 'AI Coach no configurado',
           nivelDificultad: (userProfile.fitnessLevel?.toLowerCase() as "principiante" | "intermedio" | "avanzado") || 'intermedio',
           fecha: new Date().toISOString(),
           musculos: ['General'],
           ejercicios: [{
              id: 1,
              nombre: 'Descanso activo',
              grupoMuscular: 'todo el cuerpo',
              tipo: 'aislado',
              series: 1,
              repeticiones: 1,
              descanso: '0s',
              pesokg: 0,
              notas: 'Falta configurar la llave de la IA. Ve a las variables de entorno para insertarla.'
           }]
        };
   }
}
