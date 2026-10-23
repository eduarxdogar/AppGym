import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TrainerAiService } from './trainer-ai.service';
import { BaseAiService } from './base-ai.service';
import { RecoveryService } from '../recovery.service';
import { ToastService } from '../toast.service';
import { UserProfile } from '../../models/user-profile.model';

describe('TrainerAiService fatigue context', () => {
  let service: TrainerAiService;
  let generate: jasmine.Spy;
  const recovery = signal(new Map<string, { percentage: number }>());
  const workout = { nombre: 'Push', nivelDificultad: 'intermedio', ejercicios: [] };
  const profile: UserProfile = { weight: 75, height: 175, goal: 'volumen', fitnessLevel: 'Intermedio',
    availableDays: ['Lunes'], equipment: [], fatigueLevels: { Pecho: 20 } };
  const sentFatigue = () => JSON.parse(/Fatiga Muscular Reciente[^\n]*: (\{[^\n]*\})/.exec(generate.calls.mostRecent().args[0])![1]);
  beforeEach(() => {
    recovery.set(new Map([['Pecho', { percentage: 20 }], ['Espalda', { percentage: 100 }], ['Piernas', { percentage: 0 }]]));
    generate = jasmine.createSpy('generateContent').and.resolveTo(JSON.stringify(workout));
    TestBed.configureTestingModule({ providers: [
      { provide: BaseAiService, useValue: { isConfigured: true, activeModel: signal('gemini-2.5-flash'),
        generateWorkoutContent: generate, cleanJson: (text: string) => text } },
      { provide: RecoveryService, useValue: { muscleRecoveryStatus: recovery } },
      { provide: ToastService, useValue: { showError: jasmine.createSpy('showError') } },
    ] });
    service = TestBed.inject(TrainerAiService);
  });
  it('sends fatigue rather than recovery and ignores inverted legacy profile values', async () => {
    await service.generateWorkout('Entrenar', profile);
    expect(sentFatigue()).toEqual({ Pecho: 80, Espalda: 0, Piernas: 100 });
    expect(generate.calls.mostRecent().args[0]).toContain('0% = sin fatiga; 100% = fatiga máxima');
  });
  it('uses the latest recovery snapshot for weekly plans as well as individual workouts', async () => {
    generate.and.resolveTo(JSON.stringify(workout));
    recovery.set(new Map([['Pecho', { percentage: 90 }]]));
    await service.generateWeeklyPlan({ profile, userPrompt: 'Mi semana', daysToGenerate: 1 });
    expect(sentFatigue()).toEqual({ Pecho: 10 });
  });
  it('requests bodyweight catalog constraints for Home Gym without assuming a full gym', async () => {
    await service.generateWorkout('Mi rutina', { ...profile, baseGym: 'Home Gym', equipment: ['Máquinas'] });
    const prompt = generate.calls.mostRecent().args[0];
    expect(prompt).toContain('Equipamiento: BODYWEIGHT');
    expect(prompt).toContain('SOLO calistenia de peso corporal del catálogo del servidor');
    expect(prompt).not.toContain('Equipamiento: Gimnasio completo');
  });
  for (const start of [19, 20]) {
    it(`schedules only selected days, starting on the next available day from October ${start}`, async () => {
      jasmine.clock().install();
      try {
        jasmine.clock().mockDate(new Date(2026, 9, start, 12));
        generate.and.resolveTo(JSON.stringify(workout));
        const plan = await service.generateWeeklyPlan({ profile: { ...profile,
          availableDays: ['Lunes', 'Miércoles', 'Viernes'] }, userPrompt: 'Mi semana', daysToGenerate: 3 });
        expect(plan.map(w => new Date(w.fecha!).getDay())).toEqual(start === 19 ? [1, 3, 5] : [3, 5, 1]);
        expect(plan.map(w => new Date(w.fecha!).getDate())).toEqual(start === 19 ? [19, 21, 23] : [21, 23, 26]);
        expect(new Set(plan.map(w => w.id)).size).toBe(3);
      } finally { jasmine.clock().uninstall(); }
    });
  }
  it('requests separate bounded days, keeps their order and exposes no partial week on failure', async () => {
    generate.and.callFake(async (prompt: string) => {
      const index = /COORDINACIÓN SEMANAL: Día (\d+)/.exec(prompt)![1];
      return JSON.stringify({ ...workout, nombre: `Día ${index}` });
    });
    const plan = await service.generateWeeklyPlan({ profile, userPrompt: 'Semana', daysToGenerate: 3 });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(plan.map(day => day.nombre)).toEqual(['Día 1', 'Día 2', 'Día 3']);
    expect(generate.calls.allArgs().every(args => args[0].includes('UN objeto Workout'))).toBeTrue();
    generate.calls.reset();
    generate.and.callFake(async (prompt: string) => {
      if (prompt.includes('COORDINACIÓN SEMANAL: Día 2')) throw new Error('Proveedor no disponible');
      return JSON.stringify(workout);
    });
    spyOn(console, 'error');
    await expectAsync(service.generateWeeklyPlan({ profile, userPrompt: 'Semana', daysToGenerate: 3 }))
      .toBeRejectedWithError('Proveedor no disponible');
  });
  it('rejects invalid week lengths before consuming any provider', async () => {
    spyOn(console, 'error');
    for (const daysToGenerate of [0, 8, 1.5]) {
      await expectAsync(service.generateWeeklyPlan({ profile, userPrompt: 'Semana', daysToGenerate })).toBeRejected();
    }
    expect(generate).not.toHaveBeenCalled();
  });
});
