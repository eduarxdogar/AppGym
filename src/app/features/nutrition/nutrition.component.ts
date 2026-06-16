import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NutritionAiService } from '../../core/services/ai/nutrition-ai.service';
import { WeeklyDietPlan, DayDietPlan, MealPlan } from '../../models/ai-requests.model';
import { NutritionService, DailyNutritionLog } from '../../core/services/nutrition.service';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { UserProfileService } from '../../core/services/user-profile.service';
import { GamificationService } from '../../core/services/gamification.service';

@Component({
  selector: 'app-nutrition',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nutrition.component.html'
})
export class NutritionComponent implements OnInit {
  private aiCoach = inject(NutritionAiService);
  private nutritionService = inject(NutritionService);
  private profileState = inject(UserProfileStateService);
  private profileService = inject(UserProfileService);
  private gamification = inject(GamificationService);

  /** Opt-in flag — read from Firestore profile, never assumed true. */
  useSeelegSupplements = computed(() =>
    this.profileState.profile()?.useSeelegSupplements ?? false
  );

  isSavingSeeleg = signal(false);

  // Form
  goal = 'volumen';
  weight = 75;
  targetCalories = 3000;
  mealsPerDay = '4';
  fastingProtocol = 'Sin Ayuno';
  firstMealTime = '12:00';
  budgetTier = 'Modo Estándar - Supermercado Local';
  
  rankName = computed(() => this.gamification.gamificationState().currentRank.name);

  // UI
  isLoading = signal(false);
  loadingExisting = signal(true);
  showForm = signal(false);
  activeTab = signal<'training' | 'rest'>('training');
  error = signal<string | null>(null);

  // Data
  plan = signal<WeeklyDietPlan | null>(null);
  dailyLog = signal<DailyNutritionLog | null>(null);

  // Computed Plan
  activePlan = computed((): DayDietPlan | null => {
    const p = this.plan();
    if (!p) return null;
    return this.activeTab() === 'training' ? p.trainingDay : p.restDay;
  });

  // Macros Targets
  targetDailyCalories = computed(() => this.activePlan()?.totalCalories || 0);
  targetProtein = computed(() => this.activePlan()?.macros?.protein || 0);
  targetCarbs = computed(() => this.activePlan()?.macros?.carbs || 0);
  targetFats = computed(() => this.activePlan()?.macros?.fats || 0);

  // Current Macros (from Daily Log)
  currentCalories = computed(() => this.dailyLog()?.consumedCalories || 0);
  currentProtein = computed(() => this.dailyLog()?.consumedProtein || 0);
  currentCarbs = computed(() => this.dailyLog()?.consumedCarbs || 0);
  currentFats = computed(() => this.dailyLog()?.consumedFats || 0);

  calorieProgress = computed(() => {
    const target = this.targetDailyCalories();
    if (target === 0) return 0;
    const p = (this.currentCalories() / target) * 100;
    return p > 100 ? 100 : p;
  });

  macroProgress(current: number, target: number): number {
    if (target === 0) return 0;
    const p = (current / target) * 100;
    return p > 100 ? 100 : p;
  }

  isMealConsumed(index: number): boolean {
    return !!this.dailyLog()?.consumedMeals?.[index];
  }

  ngOnInit() {
    const profile = this.profileState.profile();
    if (profile) {
      if (profile.weight) this.weight = profile.weight;
      if (profile.goal) this.goal = profile.goal;
    }

    // Get Plan
    this.nutritionService.getPlan().subscribe({
      next: (existing) => {
        if (existing) {
          this.plan.set(existing);
          this.showForm.set(false);
        } else {
          this.showForm.set(true);
        }
        this.loadingExisting.set(false);
      },
      error: () => {
        this.showForm.set(true);
        this.loadingExisting.set(false);
      }
    });

    // Subscribe to today's log
    const today = new Date().toISOString().split('T')[0];
    this.nutritionService.getDailyLog(today).subscribe(log => {
        if (log) {
            this.dailyLog.set(log);
        } else {
            this.dailyLog.set({
                date: today,
                consumedCalories: 0,
                consumedProtein: 0,
                consumedCarbs: 0,
                consumedFats: 0,
                consumedMeals: {}
            });
        }
    });
  }

  toggleForm() {
    this.showForm.update(v => !v);
    this.error.set(null);
  }

  async generate() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.aiCoach.generateDietPlan(
        { 
            goal: this.goal, 
            weight: this.weight, 
            mealsPerDay: +this.mealsPerDay,
            fastingProtocol: this.fastingProtocol, 
            firstMealTime: this.firstMealTime,
            budgetTier: this.budgetTier,
            rank: this.rankName()
        },
        this.targetCalories,
        this.useSeelegSupplements() // pass the user's explicit opt-in choice
      );
      this.plan.set(result);
      this.showForm.set(false);
      await this.nutritionService.savePlan(result);
      
      // Reset today's log
      const today = new Date().toISOString().split('T')[0];
      await this.nutritionService.updateDailyLog(today, {
          date: today,
          consumedCalories: 0,
          consumedProtein: 0,
          consumedCarbs: 0,
          consumedFats: 0,
          consumedMeals: {}
      });
    } catch (err: any) {
      this.error.set(err.message || 'No se pudo generar el plan.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleMealConsumed(index: number, meal: MealPlan) {
      const currentLog = this.dailyLog();
      if (!currentLog) return;
      
      const isCurrentlyConsumed = this.isMealConsumed(index);
      const macros = meal.mainDish;
      if (!macros) return;

      const multiplier = isCurrentlyConsumed ? -1 : 1;
      
      const newLog: DailyNutritionLog = {
          ...currentLog,
          consumedCalories: Math.max(0, currentLog.consumedCalories + (macros.calories * multiplier)),
          consumedProtein: Math.max(0, currentLog.consumedProtein + (macros.protein * multiplier)),
          consumedCarbs: Math.max(0, currentLog.consumedCarbs + (macros.carbs * multiplier)),
          consumedFats: Math.max(0, currentLog.consumedFats + (macros.fats * multiplier)),
          consumedMeals: {
              ...currentLog.consumedMeals,
              [index]: !isCurrentlyConsumed
          }
      };
      
      this.dailyLog.set(newLog);
      const today = new Date().toISOString().split('T')[0];
      await this.nutritionService.updateDailyLog(today, newLog);
  }

  /**
   * Persists the Seeleg opt-in toggle to Firestore.
   * Called from the preference toggle in the form UI.
   * Uses merge: true so it never overwrites other profile fields.
   */
  async toggleSeeleg() {
    if (this.isSavingSeeleg()) return;
    this.isSavingSeeleg.set(true);
    try {
      const current = this.profileState.profile();
      if (!current) return;
      const next = !this.useSeelegSupplements();
      await this.profileService.saveProfile({ ...current, useSeelegSupplements: next });
      // Refresh in-memory state so the computed re-evaluates
      await this.profileState.refreshProfile();
    } finally {
      this.isSavingSeeleg.set(false);
    }
  }
}
