import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { TrainingHistoryService } from './training-history.service';
import { WorkoutSession } from '../models/workout-history.model';

export interface RankTier {
  name: string;
  minKg: number;
  maxKg: number;
  color?: string;
  icon?: string;
}

export const GAMIFICATION_RANKS: RankTier[] = [
  { name: 'Madera', minKg: 0, maxKg: 50000, color: '#8B5A2B', icon: 'forest' },
  { name: 'Bronce', minKg: 50000, maxKg: 250000, color: '#CD7F32', icon: 'workspace_premium' },
  { name: 'Plata', minKg: 250000, maxKg: 1000000, color: '#C0C0C0', icon: 'star_half' },
  { name: 'Oro', minKg: 1000000, maxKg: 3000000, color: '#FFD700', icon: 'star' },
  { name: 'Platino', minKg: 3000000, maxKg: 10000000, color: '#E5E4E2', icon: 'diamond' },
  { name: 'Élite', minKg: 10000000, maxKg: Infinity, color: '#CCFF00', icon: 'local_fire_department' },
];

export interface GamificationState {
  currentRank: RankTier;
  currentTonnage: number;
  nextRankTarget: number | null;
  progressPercentage: number;
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private historyService = inject(TrainingHistoryService);

  // Reactive signal containing the full history of workouts
  private readonly history = toSignal(
    this.historyService.getHistory().pipe(
      catchError(() => of([] as WorkoutSession[]))
    ),
    { initialValue: [] as WorkoutSession[] }
  );

  /**
   * Total accumulated tonnage from all finished sessions
   */
  readonly currentTonnage = computed<number>(() => {
    return this.history().reduce((total, session) => {
      // Prioritize explicit session totalVolume, fallback to calculating it
      let sessionVol = session.totalVolume || 0;
      if (!sessionVol && session.exercises) {
        session.exercises.forEach((ex: any) => {
          ex.sets?.forEach((s: any) => {
            if (s.completed !== false) {
              const weight = Number(s.weight || s.peso || s.pesokg || 0);
              const reps = Number(s.reps || s.repeticiones || 0);
              sessionVol += (weight * reps);
            }
          });
        });
      }
      return total + sessionVol;
    }, 0);
  });

  /**
   * Reactive state containing all gamification metrics ready for the UI
   */
  readonly gamificationState = computed<GamificationState>(() => {
    const tonnage = this.currentTonnage();
    
    // Find current rank based on tonnage
    let currentRank = GAMIFICATION_RANKS[GAMIFICATION_RANKS.length - 1]; // Default to highest
    for (const rank of GAMIFICATION_RANKS) {
      if (tonnage >= rank.minKg && tonnage < rank.maxKg) {
        currentRank = rank;
        break;
      }
    }

    // Find next rank target
    const currentRankIndex = GAMIFICATION_RANKS.findIndex(r => r.name === currentRank.name);
    const nextRank = currentRankIndex < GAMIFICATION_RANKS.length - 1 
      ? GAMIFICATION_RANKS[currentRankIndex + 1] 
      : null;

    const nextRankTarget = nextRank ? nextRank.minKg : null;

    // Calculate progress percentage between the current rank's floor and the next rank's ceiling
    let progressPercentage = 100;
    if (nextRank && nextRankTarget !== null) {
      const rankBase = currentRank.minKg;
      const rankRange = nextRankTarget - rankBase;
      const earnedInRange = Math.max(0, tonnage - rankBase);
      progressPercentage = Math.max(0, Math.min(100, (earnedInRange / rankRange) * 100));
    }

    return {
      currentRank,
      currentTonnage: tonnage,
      nextRankTarget,
      progressPercentage: parseFloat(progressPercentage.toFixed(1))
    };
  });
}
