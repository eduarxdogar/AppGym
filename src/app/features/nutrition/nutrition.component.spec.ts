import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NutritionComponent } from './nutrition.component';
import { NutritionAiService } from '../../core/services/ai/nutrition-ai.service';
import { NutritionService } from '../../core/services/nutrition.service';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { UserProfileService } from '../../core/services/user-profile.service';
import { GamificationService } from '../../core/services/gamification.service';
import { WeeklyDietPlan } from '../../core/models/ai-requests.model';

describe('NutritionComponent trial plan persistence', () => {
  let component: NutritionComponent;
  let ai: { generateDietPlan: jasmine.Spy };
  let storage: { savePlan: jasmine.Spy; updateDailyLog: jasmine.Spy };
  const plan: WeeklyDietPlan = {
    trainingDay: { totalCalories: 3000, macros: { protein: 150, carbs: 375, fats: 100 }, meals: [] },
    restDay: { totalCalories: 2500, macros: { protein: 150, carbs: 250, fats: 100 }, meals: [] },
  };
  beforeEach(() => {
    ai = { generateDietPlan: jasmine.createSpy('generateDietPlan').and.resolveTo(plan) };
    storage = { savePlan: jasmine.createSpy('savePlan').and.resolveTo(),
      updateDailyLog: jasmine.createSpy('updateDailyLog').and.resolveTo() };
    TestBed.configureTestingModule({ providers: [
      { provide: NutritionAiService, useValue: ai },
      { provide: NutritionService, useValue: storage },
      { provide: UserProfileStateService, useValue: { profile: signal({ weight: 75 }) } },
      { provide: UserProfileService, useValue: {} },
      { provide: GamificationService, useValue: { gamificationState: signal({ currentRank: { name: 'Madera' } }) } },
    ] });
    component = TestBed.runInInjectionContext(() => new NutritionComponent());
    component.showForm.set(true);
  });
  it('shows the generated tracker only after storage succeeds and starts an empty daily log', async () => {
    let finishSave!: () => void;
    storage.savePlan.and.returnValue(new Promise<void>(resolve => { finishSave = resolve; }));
    const generation = component.generate();
    await Promise.resolve();
    expect(component.plan()).toBeNull();
    expect(component.showForm()).toBeTrue();
    finishSave();
    await generation;
    expect(component.plan()).toEqual(plan);
    expect(component.showForm()).toBeFalse();
    expect(component.isLoading()).toBeFalse();
    expect(storage.updateDailyLog).toHaveBeenCalledWith(jasmine.any(String), jasmine.objectContaining({
      consumedCalories: 0, consumedMeals: {},
    }));
  });
  it('keeps the previous saved tracker and shows a Spanish error if a new plan cannot be saved', async () => {
    component.plan.set(plan);
    storage.savePlan.and.rejectWith({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
    await component.generate();
    expect(component.plan()).toBe(plan);
    expect(component.showForm()).toBeTrue();
    expect(component.error()).toBe('No pudimos generar o guardar tu plan. Inténtalo de nuevo.');
    expect(component.isLoading()).toBeFalse();
    expect(storage.updateDailyLog).not.toHaveBeenCalled();
  });
  it('shows a recoverable timeout message without attempting to save an incomplete AI result', async () => {
    ai.generateDietPlan.and.rejectWith({ code: 'functions/deadline-exceeded' });
    await component.generate();
    expect(component.error()).toContain('Intenta de nuevo');
    expect(component.plan()).toBeNull();
    expect(component.isLoading()).toBeFalse();
    expect(storage.savePlan).not.toHaveBeenCalled();
  });
});
