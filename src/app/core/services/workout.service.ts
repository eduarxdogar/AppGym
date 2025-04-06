import { Injectable } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  private workoutsSubject = new BehaviorSubject<Workout[]>(this.loadFromLocalStorage());
  workouts$ = this.workoutsSubject.asObservable();

  private loadFromLocalStorage(): Workout[] {
    const data = localStorage.getItem('workouts');
    return data ? JSON.parse(data) : [];
  }

  private saveToLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.workoutsSubject.value));
  }

  getWorkouts(): Workout[] {
    return this.workoutsSubject.value;
  }

  addWorkout(workout: Workout) {
    const updated = [...this.workoutsSubject.value, workout];
    this.workoutsSubject.next(updated);
    this.saveToLocalStorage();
  }

  updateWorkout(workout: Workout) {
    const updated = this.workoutsSubject.value.map(w => w.id === workout.id ? workout : w);
    this.workoutsSubject.next(updated);
    this.saveToLocalStorage();
  }

  deleteWorkout(id: number) {
    const updated = this.workoutsSubject.value.filter(w => w.id !== id);
    this.workoutsSubject.next(updated);
    this.saveToLocalStorage();
  }

  getWorkoutById(id: number): Workout | undefined {
    return this.workoutsSubject.value.find(w => w.id === id);
  }
  getWorkoutsByGrupo(grupo: string): Workout[] {
    return this.workoutsSubject.value.filter(w =>
      w.nombre.toLowerCase().includes(grupo.toLowerCase())
    );
  }
}
