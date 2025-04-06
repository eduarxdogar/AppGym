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
})
export class WorkoutEditComponent implements OnInit {
  workout!: Workout;
  
  newExercise: Ejercicio = {
    id: Date.now(),
    nombre: '',
    grupoMuscular: 'otros',
    tipo: 'compuesto',
    series: 0,
    repeticiones: 0,
    descanso: '3 a 5 min',
    pesokg: 0,
    serieCalentamiento: 0,
    repeticionesCalentamiento: 0,
  };

  grupoMuscularOpciones = [
    'otros',
    'pecho',
    'espalda',
    'piernas',
    'hombros',
    'bíceps',
    'tríceps',
    'core',
  ];

  tiposEjercicio = ['compuesto', 'aislado'];

  editingExerciseIndex: number | null = null;

  // Declaraciones únicas para el modal
  modalVisible: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalAction: (() => void) | null = null;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.workoutService.workouts$.pipe(take(1)).subscribe((workouts) => {
      const found = workouts.find((w) => w.id === id);
      if (found) {
        this.workout = found;
      } else {
        console.error('Rutina no encontrada para ID:', id);
      }
      // Si es una rutina nueva sin nombre, inicializa el nombre
      if (!this.workout.nombre) {
        this.actualizarNombreRutinaPorGrupo(this.newExercise.grupoMuscular);
      }
      this.cdr.detectChanges();
    });
  }

  addExercise() {
    if (this.newExercise.nombre.trim() && this.newExercise.series > 0) {
      const exerciseCopy = { ...this.newExercise };

      if (this.editingExerciseIndex !== null) {
        // Editando ejercicio existente
        this.workout.ejercicios[this.editingExerciseIndex] = exerciseCopy;
        this.editingExerciseIndex = null;
      } else {
        // Agregar nuevo ejercicio
        exerciseCopy.id = Date.now();
        this.workout.ejercicios = [...this.workout.ejercicios, exerciseCopy];
      }

      // Reiniciar newExercise
      this.newExercise = {
        id: Date.now(),
        nombre: '',
        grupoMuscular: 'otros',
        tipo: 'compuesto',
        series: 0,
        repeticiones: 0,
        descanso: '3 a 5 min',
        pesokg: 0,
        serieCalentamiento: 0,
        repeticionesCalentamiento: 0,
      };

      this.workoutService.updateWorkout(this.workout);
      this.cdr.detectChanges();
    }
  }

  deleteExercise(index: number) {
    this.showModal(
      'Eliminar ejercicio',
      '¿Estás seguro de que deseas eliminar este ejercicio?',
      () => {
        this.workout.ejercicios.splice(index, 1);
        this.workoutService.updateWorkout(this.workout);
        this.cdr.detectChanges();
      }
    );
  }

  editExercise(index: number) {
    const ejercicio = this.workout.ejercicios[index];
    this.newExercise = { ...ejercicio };
    this.editingExerciseIndex = index;
    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.editingExerciseIndex = null;
    this.newExercise = {
      id: Date.now(),
      nombre: '',
      grupoMuscular: 'otros',
      tipo: 'compuesto',
      series: 0,
      repeticiones: 0,
      descanso: '3 a 5 min',
      pesokg: 0,
      serieCalentamiento: 0,
      repeticionesCalentamiento: 0,
    };
    this.cdr.detectChanges();
  }

  saveChanges() {
    this.showModal(
      'Guardar rutina',
      '¿Deseas guardar los cambios en la rutina?',
      () => {
        console.log('Rutina guardada:', this.workout);
        // Lógica real de guardado ya se ejecuta en updateWorkout,
        // o podrías agregar notificación aquí.
      }
    );
    this.router.navigate(['/workouts']);
  }

  // Método para generar el nombre automático basado en grupo muscular
  generarNombreAutomatico(grupo: string): string {
    const rutinasDelGrupo = this.workoutService.getWorkoutsByGrupo(grupo);
    const frecuencia = rutinasDelGrupo.length + 1;
    return `${grupo.charAt(0).toUpperCase() + grupo.slice(1)} F${frecuencia}`;
  }

  actualizarNombreRutinaPorGrupo(grupo: string) {
    // Si ya tiene un nombre que empieza con un grupo definido (ej. "Pecho F1"), no actualizar
    const nombreActual = this.workout.nombre;
    const gruposLimitados = ['pecho', 'espalda', 'piernas'];
    const yaTieneNombreFijo = gruposLimitados.some((g) =>
      nombreActual?.toLowerCase().startsWith(g)
    );
    if (yaTieneNombreFijo) return;

    if (gruposLimitados.includes(grupo.toLowerCase())) {
      const rutinasDelGrupo = this.workoutService.getWorkouts().filter((w) =>
        w.nombre.toLowerCase().startsWith(grupo.toLowerCase())
      );
      const frecuencia = rutinasDelGrupo.length + 1;
      if (frecuencia > 2) {
        console.log(`Ya existen 2 rutinas para el grupo muscular: ${grupo}`);
        return;
      }
      this.workout.nombre = `${grupo.charAt(0).toUpperCase() + grupo.slice(1)} F${frecuencia}`;
    }
  }

  // Métodos del modal (únicos, sin duplicados)
  showModal(title: string, message: string, onConfirm: () => void) {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalAction = onConfirm;
    this.modalVisible = true;
  }

  cancelModal() {
    this.modalVisible = false;
    this.modalAction = null;
  }

  confirmModal() {
    if (this.modalAction) {
      this.modalAction();
    }
    this.cancelModal();
  }
}
