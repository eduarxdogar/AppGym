import { UserProfile } from './user-profile.model';

export interface WeeklyPlanRequest {
  userPrompt: string;
  profile: UserProfile;
  daysToGenerate: number;
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
