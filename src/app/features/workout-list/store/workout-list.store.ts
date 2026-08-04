import { Injectable, inject, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { WorkoutListQueries } from '../api/workout-list.queries';
import { WorkoutListCommands } from '../api/workout-list.commands';
import { Workout } from '../../../core/models/workout.model';

@Injectable()
export class WorkoutListStore {
  private readonly queries = inject(WorkoutListQueries);
  private readonly commands = inject(WorkoutListCommands);

  readonly workouts: Signal<Workout[]> = toSignal(
    this.queries.getWorkoutsObservable(),
    { initialValue: [] as Workout[] }
  ) as Signal<Workout[]>;

  readonly isGenerating = signal(false);

  async addWorkout(): Promise<void> {
    const newWorkout: Workout = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(), 
      nombre: 'Nueva Rutina',
      ejercicios: [],
      nivelDificultad: 'principiante', 
    };
    await this.commands.addWorkout(newWorkout);
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.commands.deleteWorkout(id);
  }
}
