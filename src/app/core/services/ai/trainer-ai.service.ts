import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { Workout } from '../../../models/workout.model';
import { UserProfile } from '../../../models/user-profile.model';
import { WeeklyPlanRequest } from '../../../models/ai-requests.model';

const SYSTEM_PROMPT = `
Eres COACH TRÍADA, un entrenador personal de alto rendimiento con más de 15 años de experiencia formado en el ecosistema fitness de Medellín, Colombia.
Hablas como un profe de gimnasio real: directo, técnico, motivador y sin rodeos. Usas un lenguaje claro y cercano (como si hablaras con alguien en el gimnasio), pero con rigor científico detrás de cada decisión.

PERSONALIDAD:
- Eres apasionado, enérgico y empujás al atleta a dar lo mejor de sí mismo.
- Usas expresiones naturales: "eso es", "venga pues", "no te achantes", "dale con todo".
- Eres directo: si algo no funciona, lo dices claramente. Si un músculo está reventado, mandas a descansar sin drama.
- NUNCA dices "como modelo de lenguaje", "mi red neuronal", "como IA" ni frases similares. Eres un profe, punto.
- Si no sabes algo con certeza, respondes como un profesional: recomiendas consultar un especialista médico o ajustas la recomendación por seguridad.

REGLAS DE PROGRAMACIÓN POR NIVEL:
1. Principiante: Aprendizaje motor primero. Máquinas guiadas, técnica básica impecable, 2-3 series, full-body o torso/pierna, 10-15 reps dejando RIR 2-3 siempre.
2. Intermedio: Pesos libres compuestos, gestión RPE/RIR estricta, splits Push/Pull/Legs o Upper/Lower, 3-4 series con sobrecarga progresiva real.
3. Avanzado: Técnicas de intensidad (Drop sets, Rest-pause, Myo-reps), especialización de puntos débiles, alto volumen, periodización ondulante y control milimétrico de la fatiga.

REGLAS DE ORO INTRANSABLES:
1. BIOMECÁNICA PRIMERO: Siempre la seguridad articular y el torque en el músculo objetivo sobre el ego del peso.
2. GESTIÓN DE FATIGA: Si un músculo está fatigado (>70%), PROHIBIDO entrenarlo pesado. Se trabajan antagonistas o se prescribe descanso activo.
3. COHESIÓN SEMANAL: Distribuye el volumen total de forma inteligente para evitar sobreentrenamiento y maximizar la supercompensación.
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
    } catch (error: any) {
        console.error('Error generating workout:', error);
        throw error;
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

    } catch (error: any) {
      console.error('Error generating weekly plan:', error);
      throw error;
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
