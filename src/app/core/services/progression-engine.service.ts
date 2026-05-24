import { Injectable } from '@angular/core';
import { Workout } from '../../models/workout.model';

export interface ProgressionOptions {
  focus: 'weight' | 'volume';
  frequencyAdjustment: number; // 0, 1, or -1
}

@Injectable({ providedIn: 'root' })
export class ProgressionEngineService {

  /**
   * Generates the next microcycle (week) applying progressive overload.
   * Compares the user's completed reps (from activeSetsState) against the target reps.
   * If they hit the target, overload is applied based on the chosen focus.
   */
  generateNextMicrocycle(previousWeekWorkouts: Workout[], options: ProgressionOptions = { focus: 'weight', frequencyAdjustment: 0 }): Workout[] {
    let nextMicrocycle: Workout[] = [];
    const now = new Date();
    
      let baseTime = now.getTime();
      let dayIndex = 0;
      previousWeekWorkouts.forEach((oldWorkout) => {
        // "Empaquetado Consecutivo": Día 0 = Hoy, Día 1 = Mañana...
        const newDate = new Date(baseTime + (dayIndex * 24 * 60 * 60 * 1000));
        dayIndex++;
        
        const newWorkout: Workout = {
          ...oldWorkout,
          id: crypto.randomUUID(), // Generates a new unique ID
          fecha: newDate.toISOString(),
          isCompleted: false,
          status: 'idle',
          activeStartTime: undefined,
          completedAt: undefined,
          durationMinutes: undefined,
          activeSetsState: {}, // Clean the state
          ejercicios: oldWorkout.ejercicios.map((ejercicio, index) => {
            const newEjercicio = { ...ejercicio };
            
            // Analyze performance from activeSetsState
            const performedSets = oldWorkout.activeSetsState?.[index];
            if (performedSets && performedSets.length > 0) {
              let allTargetsMet = true;
              
              performedSets.forEach(set => {
                if (!set.completed || set.reps < newEjercicio.repeticiones) {
                  allTargetsMet = false;
                }
              });

              // Progressive Overload Logic
              if (allTargetsMet) {
                if (options.focus === 'weight') {
                  // Aggressive with weight
                  newEjercicio.pesokg = (newEjercicio.pesokg || 0) + 2.5;
                } else if (options.focus === 'volume') {
                  // Prioritize volume (e.g. increase target reps or add a set)
                  if (newEjercicio.repeticiones < 15) {
                    newEjercicio.repeticiones += 2;
                  } else {
                    newEjercicio.series += 1;
                  }
                }
              } else {
                // Did not meet target reps. 
                // We keep the weight, but we can encourage them to try again or slightly bump volume
                // For safety, we keep the same target weight and reps so they can master it.
              }
            } else {
              // No data recorded (maybe skipped). Keep the same.
            }

            return newEjercicio;
          })
        };

        nextMicrocycle.push(newWorkout);
      });
      
      // Handle Frequency Adjustment
      if (options.frequencyAdjustment > 0 && nextMicrocycle.length > 0) {
        // Duplicate the last workout and push it 1 day further
        const lastWorkout = nextMicrocycle[nextMicrocycle.length - 1];
        const newDate = new Date(new Date(lastWorkout.fecha!).getTime() + 24 * 60 * 60 * 1000);
        nextMicrocycle.push({
          ...lastWorkout,
          id: crypto.randomUUID(),
          fecha: newDate.toISOString()
        });
      } else if (options.frequencyAdjustment < 0 && nextMicrocycle.length > 1) {
        // Remove the last workout to drop a day
        nextMicrocycle.pop();
      }
    return nextMicrocycle;
  }
}
