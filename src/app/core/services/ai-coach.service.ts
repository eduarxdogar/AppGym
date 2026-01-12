import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  weight: number;
  height: number;
  fatigueLevels: Record<string, number>; // 'pecho': 80 (80% fatigado)
  availableDays: string[]; // ['Lunes', 'Miercoles', 'Viernes']
  equipment: string[]; // ['Mancuernas', 'Barra', 'Polea']
  goal?: 'hipertrofia' | 'fuerza' | 'resistencia' | 'perdida_peso';
  fitnessLevel?: 'Principiante' | 'Intermedio' | 'Avanzado';
}

export interface WeeklyPlanRequest {
  userPrompt: string;
  profile: UserProfile;
  daysToGenerate: number;
}

const SYSTEM_PROMPT = `
Eres un entrenador olímpico de élite, experto en biomecánica, periodización y programación de fuerza (PhD).
Tu objetivo es generar la rutina de entrenamiento PERFECTA para el usuario, basándote en su perfil, fatiga muscular reciente y equipamiento disponible.

REGLAS DE NIVEL DE FIITNESS:
1. Principiante: Prioriza máquinas, técnica básica, bajo volumen (2-3 series por ejercicio), ejercicios full-body o torso/pierna, repeticiones moderadas-altas.
2. Intermedio: Introduce pesos libres compuestos, RPE/RIR, divisiones (Push/Pull/Legs o Upper/Lower), volumen moderado (3-4 series), sobrecarga progresiva clara.
3. Avanzado: Técnicas de intensidad (Drop sets, Rest-pause, Myo-reps), especialización, alto volumen, periodización ondulante, gestión de fatiga precisa.

Reglas Generales:
1. Prioriza la seguridad y la técnica siempre.
2. Si un músculo está fatigado (>70%), NO lo entrenes directamente, enfócate en antagonistas o descanso activo.
3. Para planes semanales, asegura una distribución lógica de volumen y recuperación.
`;

@Injectable({
  providedIn: 'root'
})
export class AiCoachService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() { 
    const key = environment.geminiApiKey;
    console.log('AI Coach initialized. API Key ends with:', key ? key.slice(-4) : 'NO_KEY');
    
    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-flash-latest",
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ],
        generationConfig: { responseMimeType: "application/json" }
    });
  }

  /**
   * Genera una rutina personalizada usando Gemini API.
   */
  async generateWorkout(userPrompt: string, userProfile: UserProfile): Promise<Workout> {
    console.log('AI Coach: Generating single workout...', { userPrompt });

    const prompt = this.buildPrompt(userPrompt, userProfile, 'single');
    
    try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const cleanText = this.cleanJson(text);
        const workoutData = JSON.parse(cleanText);
        
        return {
            ...workoutData,
            id: Date.now(),
            fecha: new Date().toISOString(),
            ejercicios: workoutData.ejercicios || []
        };
    } catch (error) {
        console.error('Error generating workout:', error);
        throw error;
    }
  }

  /**
   * Genera un plan semanal completo.
   */
  async generateWeeklyPlan(request: WeeklyPlanRequest): Promise<Workout[]> {
    console.log('AI Coach: Generating weekly plan...', request);

    const prompt = this.buildPrompt(request.userPrompt, request.profile, 'weekly', request.daysToGenerate);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const cleanText = this.cleanJson(text);
      const workoutsData: any[] = JSON.parse(cleanText); // Esperamos un Array

      if (!Array.isArray(workoutsData)) {
         throw new Error('AI did not return an array of workouts');
      }

      // Procesar fechas consecutivas (comenzando mañana)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return workoutsData.map((data, index) => {
         const workoutDate = new Date(tomorrow);
         workoutDate.setDate(tomorrow.getDate() + index);

         return {
            ...data,
            id: Date.now() + index, // Unique IDs
            fecha: workoutDate.toISOString(),
            ejercicios: data.ejercicios || []
         };
      });

    } catch (error) {
      console.error('Error generating weekly plan:', error);
      throw error;
    }
  }

  private cleanJson(text: string): string {
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }

  private buildPrompt(userPrompt: string, profile: UserProfile, mode: 'single' | 'weekly', daysToGenerate: number = 1): string {
    const isWeekly = mode === 'weekly';
    const outputStructure = isWeekly 
      ? `UN ARRAY JSON de ${daysToGenerate} objetos Workout: [ {WORKOUT_1}, {WORKOUT_2}... ]`
      : `UN SOLO objeto JSON (Workout)`;

    return `
      ${SYSTEM_PROMPT}
      
      CONTEXTO DEL USUARIO:
      - Objetivo: ${profile.goal || 'Hipertrofia/General'}
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

  /**
   * Calcula la fatiga muscular basada en el historial de entrenamientos.
   */
  calculateFatigue(history: Workout[]): Record<string, number> {
    const fatigueStarts: Record<string, number> = {
      'pecho': 0, 'espalda': 0, 'hombros': 0, 'brazos': 0, 'piernas': 0, 'core': 0
    };

    if (!history || history.length === 0) return fatigueStarts;

    const now = new Date();

    history.slice(0, 5).forEach(workout => {
        if (!workout.fecha) return;
        const workoutDate = new Date(workout.fecha);
        const diffTime = Math.abs(now.getTime() - workoutDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        let impactFactor = 0;
        if (diffDays <= 1) impactFactor = 1.0;
        else if (diffDays === 2) impactFactor = 0.5;
        else if (diffDays === 3) impactFactor = 0.2;

        workout.musculos?.forEach(muscle => {
            const normalizedMuscle = muscle.toLowerCase();
            if (fatigueStarts[normalizedMuscle] !== undefined) {
                fatigueStarts[normalizedMuscle] = Math.min(100, fatigueStarts[normalizedMuscle] + (100 * impactFactor));
            }
        });
    });

    return fatigueStarts;
  }
}
