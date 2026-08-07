export interface SegmentalData {
  rightArm?: string | null;
  leftArm?: string | null;
  trunk?: string | null;
  rightLeg?: string | null;
  leftLeg?: string | null;
}

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

export interface UserProfile {
  displayName?: string;
  age?: number | null;
  weight: number;
  height: number;
  sex?: 'male' | 'female' | 'other' | null;
  goal: 'volumen' | 'definicion' | 'mantenimiento' | 'perdida_peso';
  fitnessLevel: 'Principiante' | 'Intermedio' | 'Avanzado';
  availableDays: string[];
  equipment: string[];
  fatigueLevels?: Record<string, number>;
  muscleFatigue?: Record<string, number>;
  lastFatigueUpdate?: string;
  systemRecovery?: number;
  inbodyData?: {
    muscleKg?: number | null;
    fatPercent?: number | null;
    bmr?: number | null;
    waterPercentage?: number | null;
    visceralFat?: number | null;
    boneMass?: number | null;
    score?: number | null;
    raw?: string;
    segmentalMuscle?: SegmentalData;
    segmentalFat?: SegmentalData;
  };
  baseGym?: string;
  /**
   * Opt-in flag for sponsored supplement recommendations (Seeleg).
   * Default: false / undefined. Set to true by the user explicitly via the
   * nutrition preference toggle. Must never be true by default.
   */
  useSeelegSupplements?: boolean;
  createdAt?: string;
  updatedAt?: string;
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled';
  trialEndsAt?: string;
  mpCustomerId?: string;
  /** Soft-delete flag — gestionado exclusivamente por el Super Admin o por el propio usuario. */
  isDeleted?: boolean;
  /** Timestamp (ms) del momento del soft-delete. */
  deletedAt?: number;
  /** Email del usuario — almacenado en el perfil para que el Admin pueda listarlo en la tabla. */
  email?: string;
  /** Accumulated total volume lifted (tonnage) */
  totalVolume?: number;
}
