import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';

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
export class AiCoachService {

  constructor() { }

  /**
   * Genera una rutina personalizada basada en el perfil del usuario.
   * Simula una llamada a una IA Generativa.
   */
  generateRoutine(profile: UserProfile): Observable<Workout> {
    console.log('AI Coach: Analizando perfil...', profile);
    console.log('System Prompt Loaded:', SYSTEM_PROMPT); // Simulando envío a LLM
    
    // Simulación de "Pensamiento" de la IA
    const targetMuscles = this.determineTargetMuscles(profile.fatigueLevels);
    
    const mockRoutine: Workout = {
      id: Date.now(),
      nombre: `AI Smart Routine: ${profile.goal ? profile.goal.toUpperCase() : 'GENERAL'}`,
      fecha: new Date().toISOString(),
      nivelDificultad: 'intermedio',
      musculos: targetMuscles,
      ejercicios: this.generateSmartExercises(targetMuscles)
    };

    // Retorna la rutina después de 2 segundos simulando latencia de red/procesamiento
    return of(mockRoutine).pipe(delay(2000));
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

  private determineTargetMuscles(fatigue: Record<string, number>): string[] {
    // Si pecho está fatigado (>70), sugerimos Espalda/Pierna
    // Lógica simple de demostración
    const fatiguePecho = fatigue['pecho'] || 0;
    
    if (fatiguePecho > 70) {
        return ['espalda', 'piernas'];
    }
    return ['pecho', 'tríceps'];
  }

  private generateSmartExercises(targets: string[]): Ejercicio[] {
    const exercises: Ejercicio[] = [];

    if (targets.includes('espalda')) {
        exercises.push({
            id: 2,
            nombre: 'Remo con Barra (AI Optimizada)',
            grupoMuscular: 'espalda',
            tipo: 'compuesto',
            series: 4,
            repeticiones: 12,
            pesokg: 50,
            descanso: '90s',
            notas: 'Enfócate en la retracción escapular. La IA detectó debilidad en romboides.'
        });
    }

    if (targets.includes('piernas')) {
        exercises.push({
            id: 3,
            nombre: 'Sentadilla Hack',
            grupoMuscular: 'piernas',
            tipo: 'compuesto',
            series: 3,
            repeticiones: 15,
            pesokg: 80,
            descanso: '2 min',
            dropSet: {
                sets: [
                    { porcentaje: 100, repeticiones: 15, peso: 80 },
                    { porcentaje: 70, repeticiones: 15, peso: 55 }
                ]
            },
            tipos: 'drop-set',
            notas: 'Drop Set añadido para maximizar hipertrofia metabólica.'
        });
    }

    if (targets.includes('pecho')) {
        exercises.push({
            id: 1,
            nombre: 'Press Banca Inteligente',
            grupoMuscular: 'pecho',
            tipo: 'compuesto',
            series: 4,
            repeticiones: 10,
            pesokg: 60, 
            descanso: '90s',
            serieCalentamiento: 2,
            repeticionesCalentamiento: 15,
            notas: 'Controla la excéntrica (3 segundos) para mayor daño muscular.'
        });
    }

    // Default fallback
    if (exercises.length === 0) {
        exercises.push({
            id: 99,
            nombre: 'Burpees Full Body',
            grupoMuscular: 'fullbody',
            tipo: 'compuesto',
            series: 3,
            repeticiones: 20, 
            descanso: '60s',
            pesokg: 0
        });
    }

    return exercises;
  }
}
