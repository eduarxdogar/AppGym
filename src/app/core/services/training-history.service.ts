import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { WorkoutSession } from '../../models/workout-session.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class TrainingHistoryService {
  private storageService = inject(StorageService);

  // Recupera el historial almacenado en Firestore
  getHistory(): Observable<WorkoutSession[]> {
    return this.storageService.getHistory(); // Returns any[], cast handled by consumer or service
  }

  // Agrega una sesión finalizada al historial
  async addSession(session: WorkoutSession): Promise<void> {
    // Ensure calories are calculated before saving
    if (!session.calories) {
        let durationMin = 0;
        if(session.duration) {
            durationMin = this.parseDurationToMinutes(session.duration);
        } else {
             const diff = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
             durationMin = diff / 1000 / 60;
        }
        const calculated = Math.round((durationMin * 5) + (session.totalVolume * 0.0005));
        console.log('Calculated Calories in Service:', calculated, 'DurationMin:', durationMin, 'Volume:', session.totalVolume);
        session.calories = calculated;
    } else {
        console.log('Calories already present:', session.calories);
    }
    await this.storageService.saveHistory(session);
  }

  private parseDurationToMinutes(durationStr: string): number {
      if(!durationStr) return 0;
      const parts = durationStr.split(':').map(Number);
      if (parts.some(isNaN)) return 0;

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

  getStats(type: 'volume' | 'workouts' | 'sets' | 'calories', range: 'week' | 'month' | 'year' | 'total'): Observable<any> { // Typing 'any' briefly to avoid circular dep issues with new model file in same step, will import next
      return this.storageService.getHistory().pipe(
          map(history => {
              const now = new Date();
              let startDate = new Date(0); // Default total

              if (range === 'week') startDate = new Date(now.setDate(now.getDate() - 7));
              else if (range === 'month') startDate = new Date(now.setMonth(now.getMonth() - 1));
              else if (range === 'year') startDate = new Date(now.setFullYear(now.getFullYear() - 1));

              // Filter by date
              const filtered = history.filter(h => {
                  const date = new Date(h.endTime || h.startTime || h.fecha);
                  return date >= startDate;
              }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());;

              // Process based on type
              let total = 0;
              let max = 0;
              let count = filtered.length;
              let values: number[] = [];
              let chartData: { label: string, value: number, date: Date }[] = [];

              filtered.forEach(session => {
                  let val = 0;
                  const date = new Date(session.endTime || session.startTime);
                  const label = range === 'week' ? this.formatDay(date) : this.formatDate(date);

                  if (type === 'volume') {
                      val = session.totalVolume || 0;
                      // Fallback calculate if missing
                      if (!val && session.exercises) {
                           session.exercises.forEach((ex: any) => {
                               ex.sets?.forEach((s: any) => {
                                   if(s.completed) val += (s.weight * s.reps);
                               });
                           });
                      }
                  } else if (type === 'workouts') {
                      val = 1; // Count
                  } else if (type === 'sets') {
                      session.exercises?.forEach((ex: any) => {
                          val += ex.sets?.filter((s:any) => s.completed).length || 0;
                      });
                  } else if (type === 'calories') {
                      if (session.calories !== undefined && session.calories !== null) {
                          val = session.calories;
                      } else {
                          // Estimate logic fallback
                          let durationMin = 45; 
                          if (session.duration) {
                              durationMin = this.parseDurationToMinutes(session.duration);
                          } else if (session.startTime && session.endTime) {
                              const diff = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
                              durationMin = diff / 1000 / 60;
                          }

                          const vol = session.totalVolume || 0;
                          val = Math.round((durationMin * 5) + (vol * 0.0005));
                      }
                      
                      // Final safety check
                      val = val || 0;
                  }

                  total += val;
                  if (val > max) max = val;
                  values.push(val);

                  // Aggregation for chart (simplified: one point per session, can be improved to aggregate by day)
                  // Check if label exists to aggregate same day
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

  getMuscleDistribution(): Observable<any[]> {
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
                       session.exercises.forEach((ex: any) => {
                           if(ex.grupoMuscular) {
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
