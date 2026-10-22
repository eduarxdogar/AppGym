import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { StorageService } from '../core/services/storage.service';
import { TrainingHistoryService } from '../core/services/training-history.service';
import { UserProfileStateService } from '../core/services/user-profile-state.service';
import { ChatAiService } from '../core/services/ai/chat-ai.service';
import { ExerciseService } from '../core/services/exercise.service';
import { ExerciseSeederService } from '../core/services/exercise-seeder.service';
import { WorkoutCompletionService } from '../core/services/workout-completion.service';

/** Component smoke tests never initialize Firebase or call external services. */
export function appTestProviders(): (Provider | EnvironmentProviders)[] {
  return [
    provideRouter([]), provideNoopAnimations(),
    { provide: AuthService, useValue: { currentUser: signal(null), authState$: of(null), isAdmin$: of(false), logout: jasmine.createSpy('logout') } },
    { provide: StorageService, useValue: { getHistory: () => of([]), getWorkouts: () => of([]) } },
    { provide: TrainingHistoryService, useValue: { getHistory: () => of([]) } },
    { provide: UserProfileStateService, useValue: { profile: signal(null) } },
    { provide: ChatAiService, useValue: { messages: signal([]), setActiveWorkout: jasmine.createSpy('setActiveWorkout') } },
    { provide: ExerciseService, useValue: { exercises: signal([]), getAll: () => [] } },
    { provide: ExerciseSeederService, useValue: { runSeeder: jasmine.createSpy('runSeeder').and.resolveTo() } },
    { provide: WorkoutCompletionService, useValue: { complete: jasmine.createSpy('complete') } },
    { provide: MAT_DIALOG_DATA, useValue: { id: 1, nombre: 'Press', grupoMuscular: 'Pecho', series: 3, repeticiones: 10 } },
    { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } }
  ];
}
