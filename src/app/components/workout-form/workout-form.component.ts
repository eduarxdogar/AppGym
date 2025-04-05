import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { WorkoutService } from '../../core/services/workout.service';
import { Workout } from '../../models/workout.model';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-workout-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workout-form.component.html',
  styleUrls: ['./workout-form.component.scss']
})
export class WorkoutFormComponent implements OnInit {
  @Input() workout: Workout | null = null;
  workoutForm!: FormGroup;

  constructor(private fb: FormBuilder, private workoutService: WorkoutService) {}

  ngOnInit(): void {
    this.workoutForm = this.fb.group({
      id: [this.workout ? this.workout.id : Date.now()],
      nombre: [this.workout ? this.workout.nombre : '', Validators.required],
      ejercicios: this.fb.array(this.workout ? this.workout.ejercicios.map(ej => this.createExerciseForm(ej)) : [])
    });
  }

  get ejercicios(): FormArray {
    return this.workoutForm.get('ejercicios') as FormArray;
  }

  createExerciseForm(ejercicio: any = {}): FormGroup {
    return this.fb.group({
      id: [ejercicio.id || Date.now()],
      nombre: [ejercicio.nombre || '', Validators.required],
      tipo: [ejercicio.tipo || 'compuesto', Validators.required],
      series: [ejercicio.series || 3, Validators.required],
      repeticiones: [ejercicio.repeticiones || '10-12', Validators.required],
      descanso: [ejercicio.descanso || '60s', Validators.required],
      metodo: [ejercicio.metodo || ''],
      peso: [ejercicio.peso || null]
    });
  }

  addEjercicio() {
    this.ejercicios.push(this.createExerciseForm());
  }

  removeEjercicio(index: number) {
    this.ejercicios.removeAt(index);
  }

  onSubmit() {
    if (this.workoutForm.valid) {
      const workoutData: Workout = this.workoutForm.value;
      if (this.workout) {
        this.workoutService.updateWorkout(workoutData);
      } else {
        this.workoutService.addWorkout(workoutData);
      }
    }
  }
}
