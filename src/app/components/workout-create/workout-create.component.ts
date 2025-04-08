// src/app/components/workout-create.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Workout, Ejercicio } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';

@Component({
  selector: 'app-workout-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workout-create.component.html',
  styleUrls: ['./workout-create.component.scss'],
})
export class WorkoutCreateComponent {
  nombreRutina = '';
  ejercicios: Ejercicio[] = [];

  newExercise: Ejercicio = {
    id: 0,
    nombre: '',
    grupoMuscular: 'pecho',
    tipo: 'compuesto',
    series: 3,
    repeticiones: 0,
    descanso: '60s'
  };

  constructor(private workoutService: WorkoutService, private router: Router) {}

  addExercise() {
    const id = Date.now();
    this.ejercicios.push({ ...this.newExercise, id });
    this.newExercise = {
      id: 0,
      nombre: '',
      grupoMuscular: 'pecho',
      tipo: 'compuesto',
      series: 3,
      repeticiones: 0,
      descanso: '60s'
    };
  }

  deleteExercise(index: number) {
    this.ejercicios.splice(index, 1);
  }

  saveWorkout() {
    if (!this.nombreRutina.trim() || this.ejercicios.length === 0) return;

    const newWorkout: Workout = {
      id: Date.now(),
      nombre: this.nombreRutina,
      fecha: new Date(),
      ejercicios: this.ejercicios,
    };

    this.workoutService.addWorkout(newWorkout);
    this.router.navigate(['/workouts']);
  }
}
