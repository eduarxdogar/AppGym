import { Injectable, inject, Signal, computed, signal } from '@angular/core';
import { UserProfileStateService } from '../../account/services/user-profile-state.service';
import { MuscleStatus } from '../../workouts/models/workout-history.model';
export type { MuscleStatus };

@Injectable({
  providedIn: 'root'
})
export class RecoveryService {
  private readonly userProfileState = inject(UserProfileStateService);

  /**
   * Canonical list of tracked muscle groups.
   * 'Hombros' has been split into its three anatomical heads to prevent
   * false fatigue alerts caused by treating the entire deltoid as one block.
   */
  private readonly MAIN_MUSCLES = [
    'Pecho', 'Espalda',
    'Hombro Anterior', 'Hombro Lateral', 'Hombro Posterior',
    'Bíceps', 'Tríceps', 'Antebrazos',
    'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos',
    'Core', 'Trapecio', 'Lumbares'
  ];

  /**
   * Maps raw exercise tags (from Firestore / AI output) to canonical muscle names.
   * Generic 'shoulders'/'hombros' maps to Hombro Lateral (the most commonly targeted head
   * in generic shoulder work). Specific tags map to their precise head.
   */
  private readonly MUSCLE_MAP: Record<string, string> = {
    // Pecho
    'pecho': 'Pecho', 'chest': 'Pecho', 'pectorales': 'Pecho',
    // Espalda
    'espalda': 'Espalda', 'back': 'Espalda', 'dorsales': 'Espalda',
    // Deltoides — generic tag → Hombro Lateral (default head for neutral shoulder work)
    'hombros': 'Hombro Lateral', 'shoulders': 'Hombro Lateral', 'deltoides': 'Hombro Lateral',
    // Deltoides — specific head tags
    'hombro anterior': 'Hombro Anterior', 'deltoides anterior': 'Hombro Anterior',
    'anterior deltoid': 'Hombro Anterior', 'front delt': 'Hombro Anterior',
    'hombro lateral': 'Hombro Lateral', 'deltoides lateral': 'Hombro Lateral',
    'lateral deltoid': 'Hombro Lateral', 'side delt': 'Hombro Lateral',
    'hombro posterior': 'Hombro Posterior', 'deltoides posterior': 'Hombro Posterior',
    'rear delt': 'Hombro Posterior', 'posterior deltoid': 'Hombro Posterior',
    // Arms
    'bíceps': 'Bíceps', 'biceps': 'Bíceps',
    'tríceps': 'Tríceps', 'triceps': 'Tríceps',
    'antebrazos': 'Antebrazos', 'forearms': 'Antebrazos',
    // Legs
    'cuádriceps': 'Cuádriceps', 'quads': 'Cuádriceps', 'piernas': 'Cuádriceps',
    'isquios': 'Isquios', 'hamstrings': 'Isquios',
    'glúteos': 'Glúteos', 'glutes': 'Glúteos',
    'gemelos': 'Gemelos', 'calves': 'Gemelos',
    // Core / back
    'core': 'Core', 'abs': 'Core', 'abdominales': 'Core',
    'trapecio': 'Trapecio', 'traps': 'Trapecio',
    'lumbares': 'Lumbares', 'lower_back': 'Lumbares'
  };



  readonly muscleRecoveryStatus = computed(() => {
    const profile = this.userProfileState.profile();
    return this.calculateHydratedFatigue(profile);
  });

  private readonly _selectedMuscleName = signal<string | null>(null);
  readonly selectedMuscleName = this._selectedMuscleName.asReadonly();

  constructor() {}

  setSelectedMuscle(name: string | null) {
    this._selectedMuscleName.set(name);
  }

  getMuscleRecoveryStatus(): Signal<Map<string, MuscleStatus>> {
    return this.muscleRecoveryStatus;
  }

  public normalizeMuscleName(name: string | undefined): string | undefined {
    if (!name) return undefined;
    const normalized = name.toLowerCase().trim();
    const exactMain = this.MAIN_MUSCLES.find(m => m.toLowerCase() === normalized);
    if (exactMain) return exactMain;
    if (this.MUSCLE_MAP[normalized]) return this.MUSCLE_MAP[normalized];
    return this.MAIN_MUSCLES.find(m => {
      const internal = m.toLowerCase();
      return internal.includes(normalized) || normalized.includes(internal);
    });
  }

  private calculateHydratedFatigue(profile: any): Map<string, MuscleStatus> {
    const statusMap = new Map<string, MuscleStatus>();
    if (!profile) return statusMap;

    const fatigueObj = profile.muscleFatigue || {};
    const lastUpdateStr = profile.lastFatigueUpdate;
    let hoursPassed = 0;

    if (lastUpdateStr) {
      const lastUpdate = new Date(lastUpdateStr).getTime();
      if (!isNaN(lastUpdate)) {
        hoursPassed = Math.max(0, (Date.now() - lastUpdate) / (1000 * 60 * 60));
      }
    }

    this.MAIN_MUSCLES.forEach(muscle => {
      const savedFatigue = fatigueObj[muscle] ?? 100;
      // Recuperación lineal: 72 horas para 100% -> 100/72 ≈ 1.388% por hora
      const currentFatigue = Math.min(100, savedFatigue + (1.388 * hoursPassed));
      
      statusMap.set(muscle, {
        name: muscle,
        percentage: Math.round(currentFatigue),
        totalVolume: 0
      });
    });

    return statusMap;
  }
}

