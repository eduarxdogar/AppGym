import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { Workout } from '../../../models/workout.model';
import { UserProfile } from '../../../models/user-profile.model';
import { WeeklyPlanRequest } from '../../../models/ai-requests.model';

const SYSTEM_PROMPT = `
Eres un ENTRENADOR PERSONAL DE ÉLITE y EXPERTO EN BIOMECÁNICA, HIPERTROFIA Y FITNESS CIENTÍFICO.
Tu objetivo es generar la rutina de entrenamiento PERFECTA y DEFINITIVA para el usuario, basándote estrictamente en la evidencia científica, su perfil biométrico, fatiga muscular reciente y equipamiento disponible.

TU TONO DEBE SER: Altamente motivador, directo, estructurado y profesional (estilo "coach agresivo pero científico"). No des excusas, da resultados.

REGLAS DE NIVEL DE FITNESS Y PROGRAMACIÓN:
1. Principiante: Prioriza aprendizaje motor, máquinas estabilizadas, técnica básica, bajo volumen (2-3 series por ejercicio), rutinas full-body o torso/pierna, repeticiones moderadas-altas (10-15) dejando siempre un RIR 2-3 en el tanque.
2. Intermedio: Introduce pesos libres compuestos pesados, gestión de RPE/RIR estricta, divisiones (Push/Pull/Legs o Upper/Lower), volumen moderado (3-4 series), sobrecarga progresiva programada.
3. Avanzado: Implementa técnicas de alta intensidad (Drop sets, Rest-pause, Myo-reps), especialización de puntos débiles, alto volumen, periodización ondulante, y gestión milimétrica de la fatiga.

REGLAS DE ORO:
1. BIOMECÁNICA PRIMERO: Prioriza la seguridad y la maximización del torque en el músculo objetivo por encima del peso.
2. GESTIÓN DE FATIGA: Si un músculo está fatigado (>70%), ESTÁ ESTRICTAMENTE PROHIBIDO entrenarlo directamente de forma pesada; enfócate en sus antagonistas, estabilizadores o prescribe descanso activo.
3. COHESIÓN: Para planes semanales, asegura una distribución perfecta del volumen total para evitar sobreentrenamiento y favorecer la supercompensación.
`;

@Injectable({
  providedIn: 'root'
})
export class TrainerAiService {
  private baseAi = inject(BaseAiService);
  public activeModel = this.baseAi.activeModel;

  async generateWorkout(userPrompt: string, userProfile: UserProfile): Promise<Workout> {
    if (!this.baseAi.isConfigured) {
        return this.getFallbackWorkout(userProfile);
    }

    console.log('AI Coach: Generating single workout...', { userPrompt });

    const prompt = this.buildPrompt(userPrompt, userProfile, 'single');
    
    try {
        const text = await this.baseAi.generateContent(prompt, true);
        const cleanText = this.baseAi.cleanJson(text);
        const workoutData = JSON.parse(cleanText);
        
        return {
            ...workoutData,
            id: crypto.randomUUID(),
            fecha: new Date().toISOString(),
            ejercicios: workoutData.ejercicios || []
        };
    } catch (error) {
        console.error('Error generating workout:', error);
        return this.getFallbackWorkout(userProfile);
    }
  }

  async generateWeeklyPlan(request: WeeklyPlanRequest): Promise<Workout[]> {
    if (!this.baseAi.isConfigured) {
        return [];
    }

    console.log('AI Coach: Generating weekly plan...', request);

    const prompt = this.buildPrompt(request.userPrompt, request.profile, 'weekly', request.daysToGenerate);

    try {
      const text = await this.baseAi.generateContent(prompt, true);
      const cleanText = this.baseAi.cleanJson(text);
      const workoutsData: any[] = JSON.parse(cleanText); 

      if (!Array.isArray(workoutsData)) {
         throw new Error('AI did not return an array of workouts');
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return workoutsData.map((data, index) => {
         const workoutDate = new Date(tomorrow);
         workoutDate.setDate(tomorrow.getDate() + index);

         return {
            ...data,
            id: crypto.randomUUID(),
            fecha: workoutDate.toISOString(),
            ejercicios: data.ejercicios || []
         };
      });

    } catch (error) {
      console.error('Error generating weekly plan:', error);
      return [];
    }
  }

  private buildPrompt(userPrompt: string, profile: UserProfile, mode: 'single' | 'weekly', daysToGenerate: number = 1): string {
    const isWeekly = mode === 'weekly';
    const outputStructure = isWeekly 
      ? `UN ARRAY JSON de ${daysToGenerate} objetos Workout: [ {WORKOUT_1}, {WORKOUT_2}... ]`
      : `UN SOLO objeto JSON (Workout)`;

    return `
      ${SYSTEM_PROMPT}
      
      CONTEXTO DEL USUARIO:
      - Objetivo: ${profile.goal || 'volumen'}
      - Nivel Fitness: ${profile.fitnessLevel || 'Intermedio'}
      - Equipamiento: ${profile.equipment?.join(', ') || 'Gimnasio completo'}
      - Días disponibles: ${profile.availableDays?.join(', ') || 'Cualquiera'}
      - Fatiga Muscular Reciente: ${JSON.stringify(profile.fatigueLevels || {})}
      - Solicitud específica del usuario: "${userPrompt}"

      TAREA: ${isWeekly ? `Genera un plan de ${daysToGenerate} días.` : 'Genera una rutina única.'}

      REGLA DE ORO: Debes responder EXCLUSIVAMENTE con un JSON válido. No incluyas markdown, solo el JSON raw.
      Tu respuesta debe ser: ${outputStructure}.

      ESTRUCTURA JSON DE UN WORKOUT (Interface Workout):
      {
        "nombre": "string (Nombre atractivo de la rutina)",
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
            "rir": number (Recamara, opcional),
            "notas": "string (Instrucciones técnicas específicas para ${profile.fitnessLevel})"
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
