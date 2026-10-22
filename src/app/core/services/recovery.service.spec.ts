import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { RecoveryService } from './recovery.service';
import { StorageService } from './storage.service';
import { UserProfileStateService } from './user-profile-state.service';
import { TrainingClockService } from './training-clock.service';
import { LoggerService } from './logger.service';
import { WorkoutSession, WorkoutSessionSet } from '../models/workout-session.model';
import { canonicalMuscle, musclesForMesh } from '../models/muscle-taxonomy';

describe('RecoveryService completed work and anatomy', () => {
  const time = Date.UTC(2030, 0, 10, 12);
  let history: BehaviorSubject<WorkoutSession[]>;
  let service: RecoveryService;
  const now = signal(time);
  const working = (count = 1): WorkoutSessionSet[] => Array.from({ length: count }, () => ({ weight: 50, reps: 10, completed: true, type: 'effective' }));
  const session = (group: string, sets: WorkoutSessionSet[], hoursAgo = 0): WorkoutSession => ({
    endTime: new Date(time - hoursAgo * 3_600_000).toISOString(), exercises: [{ grupoMuscular: group, sets }]
  });

  beforeEach(() => {
    now.set(time);
    history = new BehaviorSubject<WorkoutSession[]>([]);
    TestBed.configureTestingModule({ providers: [
      RecoveryService,
      { provide: StorageService, useValue: { getHistory: () => history } },
      { provide: UserProfileStateService, useValue: { profile: signal(null) } },
      { provide: TrainingClockService, useValue: { now } },
      { provide: LoggerService, useValue: { error: jasmine.createSpy('error') } }
    ] });
    service = TestBed.inject(RecoveryService);
  });

  it('keeps unexecuted muscles at 100% with zero volume and ETA', () => {
    history.next([session('Pecho', [{ weight: 50, reps: 10, completed: false }])]);
    const status = service.muscleRecoveryStatus().get('Pecho')!;
    expect(status.percentage).toBe(100);
    expect(status.totalVolume).toBe(0);
    expect(status.recoveryEtaHours).toBe(0);
    expect(status.lastWorkoutDate).toBeUndefined();
    expect(service.muscleRecoveryStatus().get('Hombro Anterior')!.percentage).toBe(100);
  });

  it('does not invent fatigue for zero weight, zero reps, missing completion or invalid numbers', () => {
    history.next([session('Pecho', [
      { weight: 0, reps: 10, completed: true }, { weight: 50, reps: 0, completed: true },
      { weight: 50, reps: 10 }, { weight: NaN, reps: 10, completed: true }
    ])]);
    expect(service.muscleRecoveryStatus().get('Pecho')!.percentage).toBe(100);
  });

  it('registers positive volume and fatigue only after completed work arrives', () => {
    expect(service.muscleRecoveryStatus().get('Pecho')!.percentage).toBe(100);
    history.next([session('Pecho', working())]);
    const status = service.muscleRecoveryStatus().get('Pecho')!;
    expect(status.totalVolume).toBe(500);
    expect(status.percentage).toBe(85);
    expect(status.recoveryEtaHours).toBe(18);
  });

  it('attributes superset volume to its own muscle and counts completed drops', () => {
    history.next([{ endTime: new Date(time).toISOString(), exercises: [{ grupoMuscular: 'Pecho',
      superSetExercise: { id: 2, nombre: 'Remo', grupoMuscular: 'Espalda' },
      sets: [{ ...working()[0], superSet: { weight: 30, reps: 10, completed: true },
        dropSets: [{ weight: 40, reps: 10, completed: true }, { weight: 90, reps: 10, completed: false }] }]
    }] }]);
    expect(service.muscleRecoveryStatus().get('Pecho')!.totalVolume).toBe(900);
    expect(service.muscleRecoveryStatus().get('Espalda')!.totalVolume).toBe(300);
  });

  it('recovers secondary muscles chronologically before applying another session', () => {
    history.next([session('Pecho', working(4)), session('Pecho', working(4), 100)]);
    expect(service.muscleRecoveryStatus().get('Hombro Anterior')!.percentage).toBe(82);
    expect(service.muscleRecoveryStatus().get('Pecho')!.percentage).toBe(40);
  });

  it('advances recovery and ETA without requiring a Firestore change', () => {
    history.next([session('Pecho', working())]);
    now.set(time + 20 * 3_600_000);
    expect(service.muscleRecoveryStatus().get('Pecho')!.percentage).toBe(100);
    expect(service.muscleRecoveryStatus().get('Pecho')!.recoveryEtaHours).toBe(0);
  });

  it('normalizes underscored deltoids and resolves the least recovered head for the GLB', () => {
    history.next([session('Hombro_Anterior', working(3)), session('hombro_lateral', working())]);
    expect(canonicalMuscle('Hombro_Posterior')).toBe('Hombro Posterior');
    expect(service.getStatusForMesh('Deltoid_L')!.name).toBe('Hombro Anterior');
    expect(service.getStatusForMesh('Deltoid_R')!.percentage).toBe(55);
    service.setSelectedMuscle('Hombro_Anterior');
    expect(service.selectedMuscleName()).toBe('Hombro Anterior');
  });

  it('maps trapezius and lower back independently instead of shadowing them with back', () => {
    expect(musclesForMesh('Traps_L')).toEqual(['Trapecio']);
    expect(musclesForMesh('LowerBack_R')).toEqual(['Lumbares']);
    expect(musclesForMesh('Pectoral_R')).toEqual(['Pecho']);
    expect(musclesForMesh('Body')).toEqual([]);
  });

  it('ignores future or malformed session dates', () => {
    history.next([{ ...session('Pecho', working()), endTime: 'bad-date' }, session('Pecho', working(), -2)]);
    expect(service.muscleRecoveryStatus().get('Pecho')!.percentage).toBe(100);
  });

  it('resolves every anatomical node in the shipped GLB to a recovery key', async () => {
    const response = await fetch('assets/models/human-anatomy.glb');
    expect(response.ok).toBeTrue();
    const buffer = await response.arrayBuffer();
    const jsonLength = new DataView(buffer).getUint32(12, true);
    const glb = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + jsonLength))) as {
      nodes: Array<{ name: string; mesh?: number }>;
    };
    const anatomical = glb.nodes.filter(node => node.mesh !== undefined && node.name !== 'Body');
    expect(anatomical.length).toBe(26);
    for (const node of anatomical) {
      expect(service.getStatusForMesh(node.name)).withContext(node.name).toBeDefined();
    }
  });
});
