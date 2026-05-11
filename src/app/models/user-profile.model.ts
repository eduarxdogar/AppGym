export interface UserProfile {
  displayName?: string;
  age?: number;
  weight: number;
  height: number;
  sex?: 'male' | 'female' | 'other';
  goal: 'volumen' | 'definicion' | 'mantenimiento' | 'perdida_peso';
  fitnessLevel: 'Principiante' | 'Intermedio' | 'Avanzado';
  availableDays: string[];
  equipment: string[];
  fatigueLevels?: Record<string, number>;
  inbodyData?: {
    muscleKg?: number;
    fatPercent?: number;
    bmr?: number;
    score?: number;
    raw?: string;
  };
  baseGym?: string;
  createdAt?: string;
  updatedAt?: string;
}
