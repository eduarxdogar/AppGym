import { TestBed } from '@angular/core/testing';
import { BaseAiService } from './base-ai.service';
import { NutritionAiService } from './nutrition-ai.service';
import { ToastService } from '../toast.service';

describe('NutritionAiService bounded daily generation', () => {
  let service: NutritionAiService;
  let generate: jasmine.Spy;
  let toast: jasmine.Spy;
  let base: { isConfigured: boolean; generateContent: jasmine.Spy; cleanJson: (text: string) => string };
  const profile = { goal: 'volumen', weight: 75, mealsPerDay: 4, fastingProtocol: '16/8',
    firstMealTime: '10:00', budgetTier: 'Económico', rank: 'Intermedio' };
  const day = { totalCalories: 2100, macros: { protein: 150, carbs: 220, fats: 67 }, meals: [
    { name: 'Desayuno', time: '10:00', mainDish: { item: 'Avena', amount: '100g', calories: 400, protein: 15, carbs: 60, fats: 10 },
      alternatives: Array.from({ length: 3 }, () => ({ item: 'Arroz', amount: '100g', calories: 400, protein: 15, carbs: 60, fats: 10 })) },
  ] };
  beforeEach(() => {
    spyOn(console, 'error');
    generate = jasmine.createSpy('generateContent').and.callFake(async (prompt: string) => JSON.stringify({ ...day,
      totalCalories: Number(/debe ser (\d+) kcal/.exec(prompt)?.[1] ?? 2100),
      meals: Array.from({ length: Number(/exactamente (\d+) comidas;/.exec(prompt)?.[1] ?? 2) }, () => day.meals[0]),
    }));
    toast = jasmine.createSpy('showError');
    base = { isConfigured: true, generateContent: generate, cleanJson: text => text };
    TestBed.configureTestingModule({ providers: [
      { provide: BaseAiService, useValue: base }, { provide: ToastService, useValue: { showError: toast } },
    ] });
    service = TestBed.inject(NutritionAiService);
  });
  it('bounds each part to two meals and combines calories and meals in the existing schema', async () => {
    const plan = await service.generateDietPlan(profile, 2100);
    expect(generate).toHaveBeenCalledTimes(4);
    expect(plan.trainingDay.meals.length).toBe(4);
    expect(plan.restDay.meals.length).toBe(4);
    expect(plan.trainingDay.totalCalories).toBe(2100);
    expect(plan.restDay.totalCalories).toBe(1733);
    const prompts = generate.calls.allArgs().map(args => args[0] as string);
    expect(prompts[0]).toContain('DÍA SOLICITADO: entrenamiento');
    expect(prompts[1]).toContain('DÍA SOLICITADO: descanso');
    expect(prompts[1]).toContain('1733 kcal');
    expect(prompts.every(prompt => prompt.includes('UN día'))).toBeTrue();
    expect(prompts.every(prompt => prompt.includes('16/8') && prompt.includes('10:00') && prompt.includes('Económico'))).toBeTrue();
    expect(prompts.every(prompt => prompt.includes('exactamente 2 comidas'))).toBeTrue();
    expect(prompts.some(prompt => prompt.includes('comidas 3 a 4 de 4'))).toBeTrue();
  });
  it('opts into a single sponsored meal only on the training day', async () => {
    await service.generateDietPlan(profile, 2100, true);
    expect(generate.calls.argsFor(0)[5]).toBeTrue();
    expect(generate.calls.argsFor(0)[0]).toContain('INTEGRACIÓN SEELEG');
    expect(generate.calls.argsFor(1)[5]).toBeFalse();
    expect(generate.calls.argsFor(1)[0]).not.toContain('INTEGRACIÓN SEELEG');
    expect(generate.calls.argsFor(1)[0]).toContain('No incluyas patrocinio');
    expect(generate.calls.allArgs().filter(args => args[5] === true).length).toBe(1);
  });
  it('preserves the no-fasting context and never enables supplements implicitly', async () => {
    const plan = await service.generateDietPlan({ ...profile, fastingProtocol: 'Sin Ayuno', mealsPerDay: 6 }, 2400);
    expect(generate.calls.allArgs().every(args => args[0].includes('NO practica ayuno') && args[0].includes('exactamente 2 comidas'))).toBeTrue();
    expect(generate).toHaveBeenCalledTimes(6);
    expect(plan.trainingDay.meals.length).toBe(6);
    expect(generate.calls.allArgs().every(args => args[5] === false)).toBeTrue();
  });
  it('rejects a failed day without exposing a partial plan', async () => {
    generate.and.callFake(async (prompt: string) => {
      if (prompt.includes('DÍA SOLICITADO: descanso')) throw { code: 'functions/unavailable' };
      return JSON.stringify({ ...day, meals: [day.meals[0], day.meals[0]] });
    });
    await expectAsync(service.generateDietPlan(profile, 2100)).toBeRejectedWith({ code: 'functions/unavailable' });
  });
  it('rejects malformed provider data with a user-facing error', async () => {
    generate.and.resolveTo('{"totalCalories":"invalid"}');
    await expectAsync(service.generateDietPlan(profile, 2100)).toBeRejectedWithError('Invalid JSON structure returned by AI');
    expect(toast).toHaveBeenCalledWith(jasmine.stringMatching('malformados'));
  });
  it('validates calorie and meal bounds before consuming any provider', async () => {
    for (const target of [0, NaN, Infinity]) await expectAsync(service.generateDietPlan(profile, target)).toBeRejected();
    for (const count of [0, 7, 1.5]) await expectAsync(service.generateDietPlan({ ...profile, mealsPerDay: count }, 2100)).toBeRejected();
    expect(generate).not.toHaveBeenCalled();
    base.isConfigured = false;
    await expectAsync(service.generateDietPlan(profile, 2100)).toBeRejectedWithError('AI Coach no configurado');
  });
  it('keeps label scans multimodal and validates their numeric result', async () => {
    const label = { calories: 100, protein: 10, carbs: 5, fats: 4 };
    generate.and.resolveTo(JSON.stringify(label));
    expect(await service.scanNutritionLabel('eA==', 'image/png')).toEqual(label);
    expect(generate.calls.mostRecent().args.slice(1)).toEqual([true, 'eA==', 'image/png']);
    generate.and.resolveTo('{"calories":"bad"}');
    await expectAsync(service.scanNutritionLabel('eA==', 'image/png')).toBeRejected();
    expect(toast).toHaveBeenCalledWith(jasmine.stringMatching('etiqueta'));
  });
});
