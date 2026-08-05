import { UserProfile } from '../../account/models/user-profile.model';

export interface ChatMessage {
  id: string;
  workoutId: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: string; // ISO string
}

export interface WeeklyPlanRequest {
  userPrompt: string;
  profile: UserProfile;
  daysToGenerate: number;
  fatigueSummary?: string;
}

export interface MealFood {
  item: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface MealPlan {
  name: string;
  time: string;
  mainDish: MealFood;
  alternatives: MealFood[];
  /**
   * Set to true by Gemini when the meal is a sponsored Seeleg product recommendation.
   * Only present when the user has opted in via useSeelegSupplements.
   */
  isSponsored?: boolean;
  /** Brand name for the sponsorship badge. Currently: 'Seeleg'. */
  sponsorBrand?: string;
}

export interface DayDietPlan {
  totalCalories: number;
  macros: { protein: number; carbs: number; fats: number };
  meals: MealPlan[];
}

export interface WeeklyDietPlan {
  trainingDay: DayDietPlan;
  restDay: DayDietPlan;
}

export type DietPlan = WeeklyDietPlan;

export interface BoxingRoutine {
  title: string;
  totalDuration: number;
  warmup: string[];
  rounds: Array<{
    roundNumber: number;
    duration: string;
    instructions: string;
    focus: 'Cardio' | 'Technique' | 'Power';
  }>;
  cooldown: string[];
}
