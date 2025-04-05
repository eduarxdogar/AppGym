import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';
import { WorkoutService } from '../../core/services/workout.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-workout-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workout-edit.component.html',
  // Si no tienes estilos, puedes crear un archivo vacío o comentar la línea:
 // styleUrls: ['./workout-edit.component.css']
})
export class WorkoutEditComponent implements OnInit {
  workout!: Workout;  // Se obtendrá desde el servicio
  newExercise: Ejercicio = {
    id: Date.now(),
    nombre: '',
    grupoMuscular: 'pecho',
    tipo: 'compuesto',
    series: 0,
    repeticiones: 0,
    descanso: '3 a 5 min',
    pesokg: 0,
  };

  grupoMuscularOpciones = [
    'pecho',
    'espalda',
    'piernas',
    'hombros',
    'bíceps',
    'tríceps',
    'core',
    'otros'
  ];

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Obtiene el id de la ruta y suscribe al observable de rutinas para obtener la rutina correspondiente.
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.workoutService.workouts$.pipe(take(1)).subscribe(workouts => {
      const found = workouts.find(w => w.id === id);
      if (found) {
        this.workout = found;
      } else {
        console.error("Rutina no encontrada para ID:", id);
      }
      this.cdr.detectChanges();
    });
  }

  addExercise() {
    if (this.newExercise.nombre.trim() && this.newExercise.series > 0) {
      // Genera un nuevo id para el ejercicio
      const exerciseCopy = { ...this.newExercise, id: Date.now() };
      // Actualiza el arreglo de ejercicios creando una nueva referencia
      this.workout.ejercicios = [...this.workout.ejercicios, exerciseCopy];
      this.workoutService.updateWorkout(this.workout);
      console.log('Ejercicio agregado:', exerciseCopy);
      console.log('Lista actual de ejercicios:', this.workout.ejercicios);
      this.cdr.detectChanges();
    }
  }

  deleteExercise(index: number) {
    this.workout.ejercicios = this.workout.ejercicios.filter((_, i) => i !== index);
    this.workoutService.updateWorkout(this.workout);
    console.log('Ejercicio eliminado, lista actual:', this.workout.ejercicios);
    this.cdr.detectChanges();
  }

  saveChanges() {
    console.log('Guardando rutina:', this.workout);
    this.workoutService.updateWorkout(this.workout);
    this.router.navigate(['/workouts']);
  }
}
