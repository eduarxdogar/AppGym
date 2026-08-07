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
        const text = await this.baseAi.callFunction('generateWorkoutPlanAI', {
            prompt,
            isJson: true
        });
        const cleanText = this.baseAi.cleanJson(text);
        const parsedData = this.sanitizeAIResponse(JSON.parse(cleanText));

        if (Array.isArray(parsedData.ejercicios)) {
            parsedData.ejercicios.forEach((ex: any) => {
                if (!Array.isArray(ex.sets) || ex.sets.length === 0) {
                    const numSeries = ex.series || ex.targetSets || 3;
                    ex.sets = Array.from({ length: numSeries }).map((_, i) => ({
                        type: i === 0 ? 'W' : 'E',
                        reps: ex.repeticiones || 10,
                        weight: ex.pesokg || 0,
                        completed: false
                    }));
                }
            });
        }
        
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
      const text = await this.baseAi.callFunction('generateWorkoutPlanAI', {
          prompt,
          isJson: true
      });
      const cleanText = this.baseAi.cleanJson(text);
      const parsedData = this.sanitizeAIResponse(JSON.parse(cleanText));

      if (Array.isArray(parsedData)) {
          parsedData.forEach((workout: any) => {
              if (Array.isArray(workout.ejercicios)) {
                  workout.ejercicios.forEach((ex: any) => {
                      if (!Array.isArray(ex.sets) || ex.sets.length === 0) {
                          const numSeries = ex.series || ex.targetSets || 3;
                          ex.sets = Array.from({ length: numSeries }).map((_, i) => ({
                              type: i === 0 ? 'W' : 'E',
                              reps: ex.repeticiones || 10,
                              weight: ex.pesokg || 0,
                              completed: false
                          }));
                      }
                  });
              }
          });
      }

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

  private sanitizeAIResponse(data: any): any {
    if (!data) return data;
    
    if (Array.isArray(data)) {
        return data.map(item => this.sanitizeAIResponse(item));
    }

    if (typeof data === 'object') {
        const sanitized = { ...data };
        
        if (Array.isArray(sanitized.ejercicios)) {
            sanitized.ejercicios = sanitized.ejercicios.map((ex: any) => {
                const cleanEx = { ...ex };
                
                if (cleanEx.name && !cleanEx.nombre) cleanEx.nombre = cleanEx.name;
                if (typeof cleanEx.sets === 'number' && !cleanEx.series) cleanEx.series = cleanEx.sets;
                if (typeof cleanEx.reps === 'number' && !cleanEx.repeticiones) cleanEx.repeticiones = cleanEx.reps;
                if (typeof cleanEx.weight === 'number' && !cleanEx.pesokg) cleanEx.pesokg = cleanEx.weight;
                
                return cleanEx;
            });
        }
        return sanitized;
    }
    
    return data;
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

    const level = (profile.fitnessLevel || 'Intermedio').toLowerCase();
    let roleInstructions = '';
    
    if (level === 'principiante') {
        roleInstructions = "REGLA DE ROL (PRINCIPIANTE): Eres un coach protector. Si la fatiga muscular del grupo objetivo supera el 70%, TIENES PERMISO para ignorar la solicitud de sobrecarga, cambiar los ejercicios para enfocarte en músculos recuperados y explicar en 'coachNotes' que se hizo por seguridad.";
    } else {
        roleInstructions = `REGLA DE ROL (INTERMEDIO/AVANZADO): Eres un asistente técnico obediente. El usuario conoce su cuerpo. TIENES ESTRICTAMENTE PROHIBIDO cambiar los ejercicios de la plantilla original o el enfoque, sin importar el nivel de fatiga. DEBES aplicar la matemática exacta de la Sobrecarga en el mismo json. Tu única acción respecto a la fatiga es usar el campo 'coachNotes' para advertirle al usuario (Ej: 'Advertencia: Tienes fatiga al 100% en pecho, pero apliqué tu sobrecarga de +2.5kg. Entrena bajo tu propio riesgo.').\n\nREGLA DE CONSERVACIÓN ESTRUCTURAL (ESQUELETO): Cuando la directiva sea de Rollover (Sobrecarga, Consolidar, Descarga), TIENES ESTRICTAMENTE PROHIBIDO cambiar el array de ejercicios. La respuesta DEBE respetar el mismo array de nombres de ejercicios (nombre o name) enviado en el historial, forzándote a comportarte como un mapeador de datos y no como un generador creativo.`;
    }

    return `
      ${roleInstructions}
      
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
      CRITICAL RULE: The field 'rir' (Repetitions in Reserve) must ALWAYS be an integer number (e.g., 1, 2, or 3). NEVER output null, undefined, or empty strings for 'rir'.

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
            "pesokg": number (Estimado para el nivel ${profile.fitnessLevel || 'Intermedio'}),
            "reasoning": "string (OBLIGATORIO si la directiva es subir peso: escribe el cálculo. Ej: 115 * 1.025 = 117.8, redondeado a 117.5)",
            "rir": number (OBLIGATORIO para avanzado: Indicar RPE/RIR objetivo. SOLO NÚMEROS ENTEROS),
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
