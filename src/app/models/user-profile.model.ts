export interface SegmentalData {
  rightArm?: string | null;
  leftArm?: string | null;
  trunk?: string | null;
  rightLeg?: string | null;
  leftLeg?: string | null;
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
  createdAt?: string;
  updatedAt?: string;
}
