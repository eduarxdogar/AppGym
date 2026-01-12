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
}

const SYSTEM_PROMPT = `
Eres un entrenador olímpico de élite, experto en biomecánica, periodización y programación de fuerza (PhD).
Tu objetivo es generar la rutina de entrenamiento PERFECTA para el usuario, basándote en su perfil, fatiga muscular reciente y equipamiento disponible.
Reglas:
1. Prioriza la seguridad y la técnica.
2. Si un músculo está fatigado (>70%), NO lo entrenes directamente, enfócate en antagonistas o descanso activo.
3. Usa técnicas avanzadas (Drop Sets, Super Sets) si el nivel es intermedio/avanzado.
4. Devuelve SOLO un JSON válido con la estructura de Workout.
`;

@Injectable({
  providedIn: 'root'
})
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
  async generateWorkout(userPrompt: string, userProfile: any): Promise<Workout> {
    console.log('AI Coach: Generating workout with Gemini...', { userPrompt, userProfile });
    console.log('AI Coach: Usando motor gemini-flash-latest');

    const prompt = this.buildPrompt(userPrompt, userProfile);
    
    try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('Gemini Response:', text);
        
        // Clean markdown if present
        let cleanText = text;
        // Elimina ```json al inicio y ``` al final
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        const workoutData = JSON.parse(cleanText);
        
        // Asignar ID y fecha
        const workout: Workout = {
            ...workoutData,
            id: Date.now(),
            fecha: new Date().toISOString(),
            // Ensure compatibility if AI misses some fields
            ejercicios: workoutData.ejercicios || []
        };
        
        return workout;
    } catch (error) {
        console.error('Error generating workout:', error);
        throw error;
    }
  }

  private buildPrompt(userPrompt: string, profile: any): string {
    return `
      ${SYSTEM_PROMPT}
      
      CONTEXTO DEL USUARIO:
      - Objetivo: ${profile.goal || 'General'}
      - Nivel: ${profile.level || 'Intermedio'}
      - Equipamiento: ${profile.equipment?.join(', ') || 'Gimnasio completo'}
      - Días disponibles: ${profile.availableDays?.join(', ') || 'Cualquiera'}
      - Fatiga Muscular Reciente: ${JSON.stringify(profile.fatigueLevels || {})}
      - Solicitud específica del usuario: "${userPrompt}"

      REGLA DE ORO: Debes responder EXCLUSIVAMENTE con un objeto JSON válido que cumpla esta estructura exacta. 
      No incluyas markdown, solo el JSON raw.

      ESTRUCTURA JSON REQUERIDA (Interface Workout):
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
            "pesokg": number (Estimado para el nivel),
            "rir": number (Recamara),
            "notas": "string (Instrucciones técnicas, usar términos como Drop Sets, RIR, Tempo)"
          }
        ]
      }

      Instrucciones adicionales:
      - Incluye al menos 6 ejercicios.
      - Cada ejercicio debe tener 3-4 series.
      - Usa terminología técnica en las notas.
      - Si hay fatiga alta en un músculo, evítalo.
    `;
  }

  /**
   * Calcula la fatiga muscular basada en el historial de entrenamientos.
   * Algoritmo simple de decaimiento lineal.
   */
  calculateFatigue(history: Workout[]): Record<string, number> {
    const fatigueStarts: Record<string, number> = {
      'pecho': 0, 'espalda': 0, 'hombros': 0, 'brazos': 0, 'piernas': 0, 'core': 0
    };

    if (!history || history.length === 0) return fatigueStarts;

    const now = new Date();

    // Iteramos sobre los últimos 5 entrenamientos
    history.slice(0, 5).forEach(workout => {
        if (!workout.fecha) return;
        const workoutDate = new Date(workout.fecha);
        const diffTime = Math.abs(now.getTime() - workoutDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        // Factor de Fatiga basado en días
        // 0-1 días: 100% de impacto
        // 2 días: 50%
        // 3 días: 20%
        // 4+ días: 0%
        let impactFactor = 0;
        if (diffDays <= 1) impactFactor = 1.0;
        else if (diffDays === 2) impactFactor = 0.5;
        else if (diffDays === 3) impactFactor = 0.2;

        workout.musculos?.forEach(muscle => {
            const normalizedMuscle = muscle.toLowerCase();
            if (fatigueStarts[normalizedMuscle] !== undefined) {
                // Acumulamos fatiga pero topeamos en 100
                fatigueStarts[normalizedMuscle] = Math.min(100, fatigueStarts[normalizedMuscle] + (100 * impactFactor));
            }
        });
    });

    return fatigueStarts;
  }
}
