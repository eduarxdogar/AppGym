import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, UiCardComponent, UiButtonComponent],
  templateUrl: './workout-list.component.html',
  styleUrls: ['./workout-list.component.scss'],
})
export class WorkoutListComponent implements OnInit {
  workouts: Workout[] = [];

  constructor(private workoutService: WorkoutService, public router: Router) {}

  ngOnInit(): void {
    this.workouts = this.workoutService.getWorkouts(); 
  }

  editWorkout(id: number) {
    this.router.navigate(['/workout', id]);
  }

  deleteWorkout(id: number) {
    this.workoutService.deleteWorkout(id);
    this.workouts = this.workoutService.getWorkouts(); 
  }

  addWorkout() {
    const newWorkout: Workout = {
      id: Date.now(),
      fecha: new Date().toISOString(), 
      nombre: 'Nueva Rutina',
      ejercicios: [],
      nivelDificultad: 'principiante', 
    };
    this.workoutService.addWorkout(newWorkout);
    this.workouts = this.workoutService.getWorkouts(); 
  }
}
