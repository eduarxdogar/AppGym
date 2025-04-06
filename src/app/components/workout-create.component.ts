import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {  Ejercicio } from '../../app/models/ejercicio.model';
import { Workout } from '../../app/models/workout.model';
import { WorkoutService } from '../core/services/workout.service';

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
    nombre: 'pecho F1', 
    grupoMuscular: 'pecho', 
    tipo: 'compuesto',
    series: 3,
    repeticiones: 10,
    descanso: '60s'
  };
  constructor(private workoutService: WorkoutService, private router: Router) {}

  addExercise() {
    const exerciseCopy = { ...this.newExercise, id: Date.now() };
    this.ejercicios = [...this.ejercicios, exerciseCopy]; // ✅ CORREGIDO
  }

  deleteExercise(index: number) {
    this.ejercicios = this.ejercicios.filter((_, i) => i !== index); // ✅ CORREGIDO
  }

  saveWorkout() {
    if (!this.nombreRutina.trim() || this.ejercicios.length === 0) return;

    const newWorkout: Workout = {
      id: Date.now(),
      nombre: this.nombreRutina,
      ejercicios: this.ejercicios
    };

    this.workoutService.addWorkout(newWorkout);
    this.router.navigate(['/workouts']);
  }
}
