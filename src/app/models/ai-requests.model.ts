import { UserProfile } from './user-profile.model';

export interface WeeklyPlanRequest {
  userPrompt: string;
  profile: UserProfile;
  daysToGenerate: number;
}

export interface DayDietPlan {
  totalCalories: number;
  macros: { protein: string; carbs: string; fats: string };
  meals: Array<{
    name: string;
    time: string;
    foods: Array<{ item: string; amount: string; calories: number }>;
  }>;
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
