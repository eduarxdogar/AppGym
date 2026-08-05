import { Injectable, inject } from '@angular/core';
import { BaseAiService } from '../../../core/services/ai/base-ai.service';
import { ToastService } from '../../../core/services/toast.service';
import { Workout } from '../models/workout.model';
import { UserProfile } from '../../account/models/user-profile.model';
import { WeeklyPlanRequest } from '../models/ai-requests.model';
import { WorkoutSchema } from '../models/schemas/workout.schema';
import { z } from 'zod';
import { TrainingHistoryService } from './training-history.service';
import { firstValueFrom } from 'rxjs';

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
4. SOBRECARGA (MATEMÁTICA ESTRICTA): 
- REGLA CRÍTICA DE SOBRECARGA: Si la directiva es SOBRECARGA (+2.5%) y la prioridad es PESO (KG), es estrictamente PROHIBIDO devolver el mismo peso del historial. DEBES realizar el cálculo matemático en el campo 'reasoning', multiplicar el peso histórico por 1.025 y asignar el nuevo valor redondeado al campo 'pesokg'. Si el historial dice 115kg, el nuevo pesokg DEBE ser mayor (ej. 117.5kg). Mantén las repeticiones iguales. Debes aplicar el incremento matemático estrictamente a CADA UNO de los ejercicios compuestos del día leyendo su peso real en el historial.
- Cuando la directiva sea SOBRECARGA y la prioridad sea REPETICIONES: Mantén el peso exacto del historial, pero suma de 1 a 2 repeticiones a las series de trabajo efectivo.
5. COACH NOTES OBLIGATORIAS: Genera un mensaje corto, directo y en tono motivador (máximo 2 líneas) en el campo 'coachNotes' explicando exactamente qué ajustaste y por qué (Ej: 'Sobrecarga aplicada: Aumentamos 2.5kg en tu peso muerto para seguir forzando la adaptación. ¡A romperla!').
`;

@Injectable({
  providedIn: 'root'
})
export class TrainerAiService {
  private readonly baseAi = inject(BaseAiService);
  private readonly toastService = inject(ToastService);
  private readonly trainingHistoryService = inject(TrainingHistoryService);
  public activeModel = this.baseAi.activeModel;

  async generateWorkout(userPrompt: string, userProfile: UserProfile): Promise<Workout> {
    if (!this.baseAi.isConfigured) {
        return this.getFallbackWorkout(userProfile);
    }

    console.log('AI Coach: Generating single workout...', { userPrompt });

    const rawHistory = await firstValueFrom(this.trainingHistoryService.getHistory());
    const historySummary = this.summarizeHistory(rawHistory);
    const prompt = this.buildPrompt(userPrompt, userProfile, 'single', 1, undefined, historySummary);
    
    try {
        const text = await this.baseAi.generateContent(prompt, true);
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

    const rawHistory = await firstValueFrom(this.trainingHistoryService.getHistory());
    const historySummary = this.summarizeHistory(rawHistory);
    const prompt = this.buildPrompt(request.userPrompt, request.profile, 'weekly', request.daysToGenerate, request.fatigueSummary, historySummary);

    try {
      const text = await this.baseAi.generateContent(prompt, true);
      const cleanText = this.baseAi.cleanJson(text);
      const parsedData = JSON.parse(cleanText);

      const workoutAiSchema = WorkoutSchema.omit({ id: true, fecha: true });
      const validation = z.array(workoutAiSchema).safeParse(parsedData);

      if (!validation.success) {
         console.error('Zod validation failed for Weekly Plan:', validation.error);
         this.toastService.showError('La IA devolvió datos semanales malformados. Intenta de nuevo.');
         throw new TypeError('AI did not return a valid array of workouts');
      }

      const today = new Date();

      return validation.data.map((data, index) => {
         const workoutDate = new Date(today);
         workoutDate.setDate(today.getDate() + index);

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

  private getExerciseMaxWeight(ex: any): number {
    const sets = ex.series || ex.sets || [];
    const completedSets = sets.filter((s: any) => s.completed === true || s.isCompleted === true);
    if (completedSets.length === 0) return 0;
    return Math.max(...completedSets.map((s: any) => Number(s.weight || s.peso || s.pesokg || 0)));
  }

  private summarizeExercise(ex: any): string | null {
    const maxWeight = this.getExerciseMaxWeight(ex);
    if (maxWeight <= 0) return null;
    const name = ex.nombre || ex.name;
    return name ? `[Historial] ${name}: ${maxWeight}kg` : null;
  }

  private summarizeHistory(history: any[]): string {
    if (!history?.length) return 'Sin historial previo.';

    const summaries = history
      .slice(0, 3)
      .flatMap((session: any) => session.ejercicios || session.exercises || [])
      .map((ex: any) => this.summarizeExercise(ex))
      .filter((s): s is string => s !== null);

    return summaries.join('\n') || 'Sin datos específicos.';
  }

  private buildPrompt(userPrompt: string, profile: UserProfile, mode: 'single' | 'weekly', daysToGenerate: number = 1, fatigueSummary?: string, historySummary?: string): string {
    const isWeekly = mode === 'weekly';
    const outputStructure = isWeekly 
      ? `UN ARRAY JSON de ${daysToGenerate} objetos Workout: [ {WORKOUT_1}, {WORKOUT_2}... ]`
      : `UN SOLO objeto JSON (Workout)`;

    const now = new Date();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const currentDayName = days[now.getDay()];
    const formattedDate = now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

    let extraTaskInstruction = isWeekly ? `Genera un plan de ${daysToGenerate} días. REGLA ESTRICTA: El Día 1 DEBE ser asignado a HOY (${currentDayName}) si es uno de los días disponibles del usuario, o al primer día disponible a partir de mañana. NO saltes días innecesariamente.` : 'Genera una rutina única.';
    if (fatigueSummary) {
      extraTaskInstruction += `\nINSTRUCCIÓN ESTRICTA POR FATIGA: No repitas rutinas de días anteriores. Analiza la fatiga y genera el día extra priorizando los grupos musculares más recuperados.`;
    }

    return `
      ${SYSTEM_PROMPT}
      
      CONTEXTO DEL USUARIO:
      - Fecha Actual: Hoy es ${currentDayName}, ${formattedDate}.
      - Objetivo: ${profile.goal || 'volumen'}
      - Nivel Fitness: ${profile.fitnessLevel || 'Intermedio'}
      - Equipamiento: ${profile.equipment?.join(', ') || 'Gimnasio completo'}
      - Días disponibles (Cronológico): ${profile.availableDays?.join(', ') || 'Cualquiera'}
      - Fatiga Muscular Reciente: ${fatigueSummary || JSON.stringify(profile.fatigueLevels || {})}
      - HISTORIAL RECIENTE (PESOS Y REPS): ${historySummary || 'No hay historial previo'}
      - Solicitud específica del usuario: "${userPrompt}"

      TAREA: ${extraTaskInstruction}

      REGLA DE ORO: Debes responder EXCLUSIVAMENTE con un JSON válido. No incluyas markdown, solo el JSON raw.
      Tu respuesta debe ser: ${outputStructure}.

      ESTRUCTURA JSON DE UN WORKOUT (Interface Workout):
      {
        "nombre": "string (OBLIGATORIO: Para nivel avanzado usar solo nomenclatura técnica: Push F1, Pull F2, Legs, etc. PROHIBIDO: Suave, Flujo, Reactivación)",
        "coachNotes": "string (OBLIGATORIO: Mensaje corto motivador explicando el ajuste, ej: sobrecarga)",
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
            "reasoning": "string (OBLIGATORIO si la directiva es subir peso: escribe el cálculo. Ej: 115 * 1.025 = 117.8, redondeado a 117.5)",
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
