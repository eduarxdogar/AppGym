import { Injectable, inject, Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { StorageService } from './storage.service';
import { Workout } from '../../models/workout.model';

export interface MuscleStatus {
  name: string;
  percentage: number; // 0-100 (0=Fatigado, 100=Fresco)
  color: string; // 'red', 'yellow', 'green'
  lastWorkoutDate?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RecoveryService {
  private storageService = inject(StorageService);

  // Lista de músculos principales a monitorear
  private readonly MAIN_MUSCLES = [
    'Pecho', 'Espalda', 'Hombros', 
    'Bíceps', 'Tríceps', 'Antebrazos',
    'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos', 
    'Core'
  ];

  // Signal reactivo del historial de entrenamientos (Realizadas)
  private history = toSignal(this.storageService.getHistory(), { initialValue: [] });

  /**
   * Signal computado que retorna el estado de recuperación de cada músculo
   * Se actualiza automáticamente cuando cambian los workouts o el usuario
   */
  readonly muscleRecoveryStatus = computed(() => {
    const sessions = this.history() as any[];
    return this.calculateFatigue(sessions);
  });

  constructor() {}

  /**
   * Obtiene el estado de recuperación (Expone el signal computado)
   */
  getMuscleRecoveryStatus(): Signal<Map<string, MuscleStatus>> {
    return this.muscleRecoveryStatus;
  }

  /**
   * Calcula la fatiga basándose en el historial
   */
  private calculateFatigue(sessions: any[]): Map<string, MuscleStatus> {
    const statusMap = new Map<string, MuscleStatus>();
    const now = Date.now();
    const RECOVERY_WINDOW_HOURS = 72; // Tiempo base para recuperación total

    // Inicializar mapa con todos los músculos al 100% (Fresco)
    this.MAIN_MUSCLES.forEach(muscle => {
      statusMap.set(muscle, {
        name: muscle,
        percentage: 100,
        color: 'green'
      });
    });

    if (!sessions || sessions.length === 0) return statusMap;

    // Buscar la última fecha de entrenamiento para cada músculo
    // Iteramos sobre todos los workouts (idealmente ordenados por fecha, pero buscamos el max)
    // Buscar la última fecha de entrenamiento para cada músculo
    sessions.forEach(session => {
        // Soporte para WorkoutSession (endTime/startTime) o legacy
        const dateStr = session.endTime || session.startTime || (session as any).fecha;
        if (!dateStr) return;
        
        const workoutDate = new Date(dateStr).getTime();
        
        // Identificar músculos trabajados en este workout
        const musclesInWorkout = new Set<string>();

        // 1. Revisar músculos explícitos
        const musclesList = session.musclesWorked || (session as any).musculos;
        if (musclesList) {
            musclesList.forEach((m: string) => musclesInWorkout.add(this.normalizeMuscleName(m)));
        }

        // 2. Revisar ejercicios (fallback)
        const exercises = session.exercises || (session as any).ejercicios;
        if (exercises) {
            exercises.forEach((exercise: any) => {
                const group = exercise.grupoMuscular || exercise.groupMuscular; 
                if (group) {
                    musclesInWorkout.add(this.normalizeMuscleName(group));
                }
            });
        }

        // Actualizar estado para los músculos encontrados
        musclesInWorkout.forEach(muscleName => {
            // Solo procesamos si está en nuestra lista principal de seguimiento
            // (O podríamos agregarlo dinámicamente, pero mantenemos la lista controlada por ahora)
            // Buscamos coincidencia parcial o exacta
            const targetMuscle = this.MAIN_MUSCLES.find(m => 
                this.normalizeMuscleName(m) === muscleName || 
                this.normalizeMuscleName(m).includes(muscleName) ||
                muscleName.includes(this.normalizeMuscleName(m))
            );

            if (targetMuscle) {
                const currentStatus = statusMap.get(targetMuscle);
                
                // Si encontramos una fecha más reciente para este músculo, recalculamos
                if (currentStatus && (!currentStatus.lastWorkoutDate || workoutDate > currentStatus.lastWorkoutDate.getTime())) {
                    
                    const hoursElapsed = (now - workoutDate) / (1000 * 60 * 60);
                    
                    // Fórmula: Porcentaje de recuperación
                    // Si pasaron 0 horas, recuperación es 0%
                    // Si pasaron 72 horas o más, recuperación es 100%
                    let recoveryPercentage = Math.min(100, (hoursElapsed / RECOVERY_WINDOW_HOURS) * 100);
                    
                    // Asignar color
                    const color = this.getColorForPercentage(recoveryPercentage);

                    statusMap.set(targetMuscle, {
                        name: targetMuscle,
                        percentage: Math.round(recoveryPercentage),
                        color: color,
                        lastWorkoutDate: new Date(workoutDate)
                    });
                }
            }
        });
    });

    return statusMap;
  }

  /**
   * Normaliza nombres de músculos para comparación (minusculizar, quitar acentos si fuera necesario)
   */
  private normalizeMuscleName(name: string): string {
    return name.toLowerCase().trim();
  }

  /**
   * Determina el color basado en el porcentaje de recuperación
   */
  getColorForPercentage(percent: number): string {
    if (percent <= 40) return 'red'; // Fatigado
    if (percent <= 80) return 'yellow'; // Recuperando
    return 'green'; // Fresco
  }
}
