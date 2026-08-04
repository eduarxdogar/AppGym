import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Workout } from '../../models/workout.model';
import { StorageService } from '../../../../core/services/storage.service';

@Injectable({ providedIn: 'root' })
export class WorkoutListQueries {
  private readonly storage = inject(StorageService);

  getWorkoutsObservable(): Observable<Workout[]> {
    return this.storage.getWorkouts() as Observable<Workout[]>;
  }
}
