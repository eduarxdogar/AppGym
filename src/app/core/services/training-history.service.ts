import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { WorkoutSession, WorkoutExercise } from '../../features/workouts/models/workout-history.model';
import { StorageService } from './storage.service';
import { LoggerService } from './logger.service';

export interface HistoryStats {
  total: number;
  max: number;
  avg: number;
  count: number;
  chartData: { label: string; value: number; date: Date }[];
}

export interface MuscleDistribution {
  label: string;
  value: number;
}

@Injectable({ providedIn: 'root' })
export class TrainingHistoryService {
  private readonly storageService = inject(StorageService);
  private readonly logger = inject(LoggerService);

  // Recupera el historial almacenado en Firestore
  getHistory(): Observable<WorkoutSession[]> {
    return this.storageService.getHistory();
  }

  // Agrega una sesión finalizada al historial
  async addSession(session: WorkoutSession): Promise<void> {
    // Ensure calories are calculated before saving
    if (!session.calories) {
        let durationMin = 0;
        if (session.duration) {
            durationMin = this.parseDurationToMinutes(session.duration);
        } else if (session.endTime && session.startTime) {
             const diff = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
             durationMin = diff / 1000 / 60;
        }
        const calculated = Math.round((durationMin * 5) + ((session.totalVolume || 0) * 0.0005));
        this.logger.log('Calculated Calories in Service:', calculated, 'DurationMin:', durationMin, 'Volume:', session.totalVolume);
        session.calories = calculated;
    } else {
        this.logger.log('Calories already present:', session.calories);
    }
    await this.storageService.saveHistory(session);
  }

  private parseDurationToMinutes(durationStr: string): number {
      if (!durationStr) return 0;
      const parts = durationStr.split(':').map(Number);
      if (parts.some(Number.isNaN)) return 0;

      if (parts.length === 3) {
          // HH:MM:SS
          return (parts[0] * 60) + parts[1] + (parts[2] / 60);
      } else if (parts.length === 2) {
          // MM:SS
          return parts[0] + (parts[1] / 60);
      }
      return 0; // Unknown format
  }

  // --- STATS LOGIC ---

  getStats(type: 'volume' | 'workouts' | 'sets' | 'calories', range: 'week' | 'month' | 'year' | 'total', muscleGroup: string = 'Todos'): Observable<HistoryStats> {
      return this.storageService.getHistory().pipe(
          map(history => {
              const now = new Date();
              let startDate = new Date(0); // Default total

              if (range === 'week') startDate = new Date(now.setDate(now.getDate() - 7));
              else if (range === 'month') startDate = new Date(now.setMonth(now.getMonth() - 1));
              else if (range === 'year') startDate = new Date(now.setFullYear(now.getFullYear() - 1));

              // Filter by date and muscle group
              const filtered = history.filter(h => {
                  const date = new Date(h.endTime || h.startTime || h.fecha || '');
                  const matchesDate = date >= startDate;
                  
                  let matchesMuscle = true;
                  if (muscleGroup !== 'Todos') {
                     const muscles = h.musclesWorked || h.musculos || [];
                     const matchesArr = muscles.some((m: string) => m.toLowerCase().includes(muscleGroup.toLowerCase()));
                     let matchesEx = false;
                     if (h.exercises) {
                         matchesEx = h.exercises.some((ex: WorkoutExercise) => ex.grupoMuscular?.toLowerCase().includes(muscleGroup.toLowerCase()));
                     }
                     matchesMuscle = matchesArr || matchesEx;
                  }

                  return matchesDate && matchesMuscle;
              }).sort((a, b) => new Date(a.startTime || '').getTime() - new Date(b.startTime || '').getTime());

              // Process based on type
              let total = 0;
              let max = 0;
              const count = filtered.length;
              const chartData: { label: string, value: number, date: Date }[] = [];

              filtered.forEach(session => {
                  const val = this.calculateSessionValue(session, type);
                  const date = new Date(session.endTime || session.startTime || '');
                  const label = range === 'week' ? this.formatDay(date) : this.formatDate(date);

                  total += val;
                  if (val > max) max = val;

                  const existing = chartData.find(d => d.label === label);
                  if (existing) {
                      existing.value += val;
                  } else {
                      chartData.push({ label, value: val, date });
                  }
              });

              const avg = count > 0 ? Math.round(total / count) : 0;

              return {
                  total,
                  max,
                  avg,
                  count,
                  chartData
              };
          })
      );
  }

  private calculateSessionValue(session: WorkoutSession, type: 'volume' | 'workouts' | 'sets' | 'calories'): number {
      if (type === 'volume') return this.calculateSessionVolume(session);
      if (type === 'workouts') return 1;
      if (type === 'sets') return this.calculateSessionSets(session);
      if (type === 'calories') return this.calculateSessionCalories(session);
      return 0;
  }

  private calculateSessionVolume(session: WorkoutSession): number {
      if (session.totalVolume) return session.totalVolume;
      if (!session.exercises) return 0;
      let vol = 0;
      for (const ex of session.exercises as WorkoutExercise[]) {
          if (!ex.sets) continue;
          for (const s of ex.sets) {
              if (s.completed) vol += ((s.weight || 0) * (s.reps || 0));
          }
      }
      return vol;
  }

  private calculateSessionSets(session: WorkoutSession): number {
      if (!session.exercises) return 0;
      let count = 0;
      for (const ex of session.exercises as WorkoutExercise[]) {
          if (!ex.sets) continue;
          for (const s of ex.sets) {
              if (s.completed) count++;
          }
      }
      return count;
  }

  private calculateSessionCalories(session: WorkoutSession): number {
      if (session.calories !== undefined && session.calories !== null) {
          return session.calories;
      }
      let durationMin = 45; 
      if (session.duration) {
          durationMin = this.parseDurationToMinutes(session.duration);
      } else if (session.startTime && session.endTime) {
          const diff = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
          durationMin = diff / 1000 / 60;
      }

      const vol = session.totalVolume || 0;
      return Math.round((durationMin * 5) + (vol * 0.0005));
  }

  getMuscleDistribution(): Observable<MuscleDistribution[]> {
      return this.storageService.getHistory().pipe(
          map(history => {
              const muscleCounts: Record<string, number> = {};
              
              history.forEach(session => {
                  // Check explicit muscle list
                  const muscles = session.musclesWorked || session.musculos || [];
                  muscles.forEach((m: string) => {
                      const name = m.trim();
                      muscleCounts[name] = (muscleCounts[name] || 0) + 1;
                  });

                  // Check exercises if needed (fallback)
                  if (muscles.length === 0 && session.exercises) {
                       (session.exercises as WorkoutExercise[]).forEach(ex => {
                           if (ex.grupoMuscular) {
                               const name = ex.grupoMuscular.trim();
                               muscleCounts[name] = (muscleCounts[name] || 0) + 1;
                           }
                       });
                  }
              });

              return Object.keys(muscleCounts).map(key => ({
                  label: key,
                  value: muscleCounts[key]
              })).sort((a,b) => b.value - a.value);
          })
      );
  }

  private formatDay(date: Date): string {
      const days = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
      return days[date.getDay()];
  }

  private formatDate(date: Date): string {
      return `${date.getDate()}/${date.getMonth()+1}`;
  }
}
