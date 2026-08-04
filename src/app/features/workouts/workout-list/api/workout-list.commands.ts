import { Injectable, inject } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { StorageService } from '../../../../core/services/storage.service';

@Injectable({ providedIn: 'root' })
export class WorkoutListCommands {
  private readonly storage = inject(StorageService);

  async addWorkout(workout: Workout): Promise<void> {
    await this.storage.saveWorkout(workout);
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.storage.deleteWorkout(id);
  }
}
