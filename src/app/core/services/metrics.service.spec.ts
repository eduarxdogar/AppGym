import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MetricsService } from './metrics.service';
import { StorageService } from './storage.service';
import { CardioSessionService } from './cardio-session.service';
import { TrainingClockService } from './training-clock.service';
import { WorkoutSession } from '../models/workout-session.model';

describe('MetricsService executed loads', () => {
  const time = Date.UTC(2030, 0, 10, 12);
  let history: BehaviorSubject<WorkoutSession[]>;
  let service: MetricsService;
  const now = signal(time);

  beforeEach(() => {
    now.set(time);
    history = new BehaviorSubject<WorkoutSession[]>([]);
    TestBed.configureTestingModule({ providers: [
      MetricsService,
      { provide: StorageService, useValue: { getHistory: () => history } },
      { provide: CardioSessionService, useValue: { cardioSessions: signal([]) } },
      { provide: TrainingClockService, useValue: { now } }
    ] });
    service = TestBed.inject(MetricsService);
  });

  function emit(exercises: WorkoutSession['exercises'], totalVolume = 0): void {
    history.next([{ endTime: new Date(time).toISOString(), exercises, totalVolume }]);
  }

  it('does not count unchecked sets or a stale stored volume', () => {
    emit([{ sets: [{ weight: 100, reps: 10, completed: false }] }], 9999);
    expect(service.totalVolume()).toBe(0);
    expect(service.totalSets()).toBe(0);
  });

  it('includes completed dropsets, supersets and a superset inside a drop', () => {
    emit([{ sets: [{ weight: 50, reps: 10, completed: true,
      superSet: { weight: 30, reps: 10, completed: true },
      dropSets: [{ weight: 40, reps: 10, completed: true,
        superSet: { weight: 20, reps: 10, completed: true } },
        { weight: 90, reps: 10, completed: false }]
    }] }]);
    expect(service.totalVolume()).toBe(1400);
    expect(service.totalSets()).toBe(4);
  });

  it('requires explicit completion for every child load', () => {
    emit([{ sets: [{ weight: 50, reps: 10, completed: true,
      superSet: { weight: 30, reps: 10 }, dropSets: [{ weight: 40, reps: 10 }]
    }] }]);
    expect(service.totalVolume()).toBe(500);
  });

  it('updates when history changes and supports legacy load names', () => {
    emit([{ series: [{ peso: 20, repeticiones: 5, completed: true }] }]);
    expect(service.totalVolume()).toBe(100);
    emit([{ sets: [{ weight: 50, reps: 10, completed: true }] }]);
    expect(service.totalVolume()).toBe(500);
  });

  it('expires sessions when the reactive clock advances', () => {
    emit([{ sets: [{ weight: 50, reps: 10, completed: true }] }]);
    now.set(time + 8 * 86_400_000);
    expect(service.totalVolume()).toBe(0);
    expect(service.workoutsCount()).toBe(0);
  });

  it('uses stored calories and includes the entire first calendar day of a cycle', () => {
    history.next([{ startTime: new Date(time - 3_600_000).toISOString(), endTime: new Date(time).toISOString(), calories: 123 }]);
    expect(service.gymCalories()).toBe(123);
    const start = new Date(time); start.setHours(23);
    expect(service.getMicrocycleSessions(start, new Date(time)).length).toBe(1);
  });
});
