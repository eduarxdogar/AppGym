import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { TrainingHistoryService } from '../../workouts/services/training-history.service';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../../workouts/models/workout-history.model';
import { GAMIFICATION_RANKS, GamificationState } from '../../account/models/user-profile.model';
import { UserProfileStateService } from '../../account/services/user-profile-state.service';

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly historyService = inject(TrainingHistoryService);

  // Reactive signal containing the full history of workouts
  private readonly history = toSignal(
    this.historyService.getHistory().pipe(
      catchError(() => of([] as WorkoutSession[]))
    ),
    { initialValue: [] as WorkoutSession[] }
  );

  private readonly userProfileState = inject(UserProfileStateService);

  /**
   * Total accumulated tonnage from the user's profile
   */
  readonly currentTonnage = computed<number>(() => {
    return this.userProfileState.profile()?.totalVolume || 0;
  });

  /**
   * Reactive state containing all gamification metrics ready for the UI
   */
  readonly gamificationState = computed<GamificationState>(() => {
    const tonnage = this.currentTonnage();
    
    // Find current rank based on tonnage
    let currentRank = GAMIFICATION_RANKS.at(-1)!; // Default to highest
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
      progressPercentage: Number.parseFloat(progressPercentage.toFixed(1))
    };
  });
}


