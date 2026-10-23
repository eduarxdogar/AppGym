import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { AuthService } from '../auth.service';
import { UserProfileStateService } from '../user-profile-state.service';
import { WorkoutService } from '../workout.service';
import { MetricsService } from '../metrics.service';
import { CardioSessionService } from '../cardio-session.service';
import { StorageService } from '../storage.service';
import { ExerciseImageService } from '../exercise-image.service';
import { RecoveryService } from '../recovery.service';
import { ToastService } from '../toast.service';
import { BaseAiService } from './base-ai.service';
import { ChatAiService } from './chat-ai.service';

describe('ChatAiService', () => {
  let service: ChatAiService;
  let generate: jasmine.Spy;
  let save: jasmine.Spy;
  let getHistory: jasmine.Spy;
  let toast: jasmine.Spy;
  const user = signal<{ uid: string } | null>({ uid: 'trial-user' });
  beforeEach(() => {
    user.set({ uid: 'trial-user' });
    generate = jasmine.createSpy('generateContent').and.resolveTo('Bienvenido a Tríada');
    save = jasmine.createSpy('saveChatMessages').and.resolveTo();
    getHistory = jasmine.createSpy('getChatHistory').and.returnValue(of([]));
    toast = jasmine.createSpy('showError');
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { currentUser: user } },
      { provide: BaseAiService, useValue: { isConfigured: true, generateContent: generate } },
      { provide: UserProfileStateService, useValue: { profile: signal({ weight: 75, height: 175, fitnessLevel: 'Intermedio', goal: 'volumen' }) } },
      { provide: WorkoutService, useValue: { workouts: signal([]) } },
      { provide: MetricsService, useValue: { weeklyMetrics: signal({}) } },
      { provide: CardioSessionService, useValue: { cardioSessions: signal([]) } },
      { provide: StorageService, useValue: { getChatHistory: getHistory, saveChatMessages: save } },
      { provide: ExerciseImageService, useValue: {} },
      { provide: RecoveryService, useValue: { getMuscleRecoveryStatus: () => signal(new Map()) } },
      { provide: ToastService, useValue: { showError: toast } },
    ] });
    service = TestBed.inject(ChatAiService);
    TestBed.flushEffects();
  });
  it('shows the real answer and the user message in global chat without an active workout', async () => {
    await service.chatWithCoach('Hola', undefined, '');
    expect(service.messages().map(m => m.text)).toEqual(['Hola', 'Bienvenido a Tríada']);
    expect(save).not.toHaveBeenCalled();
    expect(generate.calls.mostRecent().args[4][0].parts[0].text).toContain('PERFIL DEL ATLETA');
  });
  it('shows a controlled provider error and does not include a failed turn in the next request', async () => {
    generate.and.rejectWith({ code: 'functions/permission-denied' });
    await service.chatWithCoach('mensaje fallido');
    expect(service.messages().at(-1)?.text).toContain('período de prueba');
    generate.and.resolveTo('Ahora sí');
    await service.chatWithCoach('reintento');
    expect(JSON.stringify(generate.calls.mostRecent().args[4])).not.toContain('mensaje fallido');
    expect(service.messages().at(-1)?.text).toBe('Ahora sí');
  });
  it('saves the complete workout exchange together and keeps the answer if storage fails', async () => {
    service.setActiveWorkout('workout-1');
    save.and.rejectWith(new Error('offline'));
    await service.chatWithCoach('Hola');
    expect(save.calls.mostRecent().args[0]).toBe('workout-1');
    const messages = save.calls.mostRecent().args[1];
    expect(messages.map((m: { role: string }) => m.role)).toEqual(['user', 'coach']);
    expect(messages[0].id).not.toBe(messages[1].id);
    expect(service.messages().at(-1)?.text).toBe('Bienvenido a Tríada');
    expect(toast).toHaveBeenCalledTimes(1);
  });
  it('releases the old history listener when changing workouts and on destruction', () => {
    let listeners = 0;
    getHistory.and.callFake(() => new Observable(next => {
      listeners++; next.next([]); return () => { listeners--; };
    }));
    service.setActiveWorkout('first'); service.setActiveWorkout('second');
    expect(listeners).toBe(1);
    TestBed.resetTestingModule();
    expect(listeners).toBe(0);
  });
  it('clears account-specific messages and ignores an in-flight answer after switching accounts', async () => {
    let finish!: (value: string) => void;
    generate.and.returnValue(new Promise<string>(resolve => { finish = resolve; }));
    const pending = service.chatWithCoach('Consulta anterior');
    user.set({ uid: 'another-user' }); TestBed.flushEffects();
    finish('Respuesta de la cuenta anterior'); await pending;
    expect(service.messages()).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });
});
