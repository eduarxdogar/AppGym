import { Injectable, signal, inject } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { environment } from '../../../environments/environment';
import { WorkoutService } from './workout.service';

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
export class AiCoachService {
  private genAI: GoogleGenerativeAI | null = null;
  public activeModel = signal<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  private isConfigured = false;
  
  private workoutService = inject(WorkoutService);
  private chatSession: any = null;

  constructor() { 
    const key = environment.geminiApiKey;
    
    if (!key || key.includes('PEGAR_AQUI') || key === '') {
        console.warn("⚠️ Falta configurar la API Key de Gemini en environment.ts. AI Coach desactivado.");
        this.isConfigured = false;
        return;
    }

    console.log('AI Coach initialized. API Key ends with:', environment.geminiApiKey.slice(-4));
    this.isConfigured = true;
    this.genAI = new GoogleGenerativeAI(environment.geminiApiKey);
  }

  private getModel(isJson: boolean = true) {
     if (!this.genAI) return null;
     return this.genAI.getGenerativeModel({ 
        model: this.activeModel(),
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
     });
  }

  /**
   * Genera una rutina personalizada usando Gemini API.
   */
  async generateWorkout(userPrompt: string, userProfile: UserProfile): Promise<Workout> {
    const activeModelInstance = this.getModel(true);
    if (!this.isConfigured || !activeModelInstance) {
        return this.getFallbackWorkout(userProfile);
    }

    console.log('AI Coach: Generating single workout...', { userPrompt });

    const prompt = this.buildPrompt(userPrompt, userProfile, 'single');
    
    try {
        const result = await activeModelInstance.generateContent(prompt);
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
        // Fallback en lugar de romperse para que UI pueda manejarlo suavemente
        return this.getFallbackWorkout(userProfile);
    }
  }

  /**
   * Genera un plan semanal completo.
   */
  async generateWeeklyPlan(request: WeeklyPlanRequest): Promise<Workout[]> {
    const activeModelInstance = this.getModel(true);
    if (!this.isConfigured || !activeModelInstance) {
        return [];
    }

    console.log('AI Coach: Generating weekly plan...', request);

    const prompt = this.buildPrompt(request.userPrompt, request.profile, 'weekly', request.daysToGenerate);

    try {
      const result = await activeModelInstance.generateContent(prompt);
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
      // Retornar fallback vacio o un error manejado
      return [];
    }
  }

  /**
   * Envía un mensaje de texto plano a la IA (Chat).
   */
  async chatWithCoach(message: string): Promise<string> {
    const activeModelInstance = this.getModel(false);
    if (!this.isConfigured || !activeModelInstance) {
        return "El AI Coach no está configurado. Por favor provee la API Key.";
    }

    try {
        if (!this.chatSession) {
            const contextText = "Eres el AI Coach de la app Tríada. Háblale al usuario en tono motivador, directo y científico. RESPONDE SOLO EN TEXTO/MARKDOWN, NUNCA EN JSON. El usuario actualmente tiene este plan de entrenamiento en su base de datos: " + JSON.stringify(this.workoutService.workouts()) + ". Usa esta información para responder sus dudas.";
            this.chatSession = activeModelInstance.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: contextText }],
                    },
                    {
                        role: "model",
                        parts: [{ text: "¡Entendido! Soy tu Coach de Tríada, listo para mutar y organizar tu entrenamiento basado en tu plan de datos." }],
                    },
                ]
            });
        }
        
        const result = await this.chatSession.sendMessage(message);
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error('Error al chatear con Coach:', err);
        return "Mi red neuronal falló, repite eso soldad@.";
    }
  }

   private getFallbackWorkout(userProfile: UserProfile): Workout {
       return {
           id: Date.now(),
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
