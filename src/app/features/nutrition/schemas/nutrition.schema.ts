import { z } from 'zod';

export const MealFoodSchema = z.object({
  item: z.string(),
  amount: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fats: z.number(),
}).strict();

export const MealPlanSchema = z.object({
  name: z.string(),
  time: z.string(),
  mainDish: MealFoodSchema,
  alternatives: z.array(MealFoodSchema),
  isSponsored: z.boolean().optional(),
  sponsorBrand: z.string().optional(),
}).strict();

export const DayDietPlanSchema = z.object({
  totalCalories: z.number(),
  macros: z.object({
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
  }).strict(),
  meals: z.array(MealPlanSchema),
}).strict();

export const WeeklyDietPlanSchema = z.object({
  trainingDay: DayDietPlanSchema,
  restDay: DayDietPlanSchema,
}).strict();

export const NutritionLabelSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fats: z.number(),
}).strict();

export type MealFood = z.infer<typeof MealFoodSchema>;
export type MealPlan = z.infer<typeof MealPlanSchema>;
export type DayDietPlan = z.infer<typeof DayDietPlanSchema>;
export type WeeklyDietPlan = z.infer<typeof WeeklyDietPlanSchema>;
