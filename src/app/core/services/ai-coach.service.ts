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
    
    // Simulación de "Pensamiento" de la IA
    const mockRoutine: Workout = {
      id: Date.now(),
      nombre: `AI Smart Routine: ${profile.goal ? profile.goal.toUpperCase() : 'GENERAL'}`,
      fecha: new Date().toISOString(),
      nivelDificultad: 'intermedio',
      musculos: this.determineTargetMuscles(profile.fatigueLevels),
      ejercicios: this.generateSmartExercises(profile)
    };

    // Retorna la rutina después de 2 segundos simulando latencia de red/procesamiento
    return of(mockRoutine).pipe(delay(2000));
  }

  private determineTargetMuscles(fatigue: Record<string, number>): string[] {
    // Lógica simple: Si la fatiga es baja (<30), es un buen candidato.
    // Esto es solo un mock, la IA real sería mucho más compleja.
    const freshMuscles = Object.keys(fatigue).filter(m => fatigue[m] < 40);
    return freshMuscles.length > 0 ? freshMuscles.slice(0, 3) : ['fullbody'];
  }

  private generateSmartExercises(profile: UserProfile): Ejercicio[] {
    // Mock exercises
    return [
      {
        id: 1,
        nombre: 'Press Banca Inteligente',
        grupoMuscular: 'pecho',
        tipo: 'compuesto',
        series: 4,
        repeticiones: 10,
        pesokg: 60, // Podría ser calculado basado en 1RM si tuviéramos ese dato
        descanso: '90s',
        serieCalentamiento: 2,
        repeticionesCalentamiento: 15
      },
      {
        id: 2,
        nombre: 'Remo con Barra (AI Optimizada)',
        grupoMuscular: 'espalda',
        tipo: 'compuesto',
        series: 4,
        repeticiones: 12,
        pesokg: 50,
        descanso: '90s'
      },
      {
        id: 3,
        nombre: 'Sentadilla Hack',
        grupoMuscular: 'piernas',
        tipo: 'compuesto',
        series: 3,
        repeticiones: 15,
        pesokg: 80,
        descanso: '2 min'
      }
    ];
  }
}
