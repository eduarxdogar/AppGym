import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';
import { WorkoutService } from '../../core/services/workout.service';
import { take } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOptionModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { EditarSuperSetModalComponent } from '../modals/editar-super-set-modal/editar-super-set-modal.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { CardComponent } from '../../shared/ui/card/card.component';



@Component({
  selector: 'app-workout-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatFormFieldModule, MatOptionModule, ButtonComponent, InputComponent, CardComponent],
  templateUrl: './workout-edit.component.html',
})
export class WorkoutEditComponent implements OnInit {
  workout!: Workout;
  // Para el formulario de ejercicio nuevo o edición
  newExercise: Ejercicio = this.createEmptyExercise();

  // Opciones para select de grupo muscular
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

  // Opciones simples para tipo de ejercicio (principiante)
  tiposEjercicio = ['compuesto', 'aislado'];
  // Opciones de nivel para la rutina
  nivelesDisponibles: ('principiante' | 'intermedio' | 'avanzado')[] = ['principiante', 'intermedio', 'avanzado'];

  // Variables para edición de ejercicio
  editingExerciseIndex: number | null = null;
  workoutId!: number;

  // Control del acordeón para expandir detalles
  expandedIndex: number | null = null;

  // Asumimos que el nivel se establece en la rutina (workout)
  // Además, usamos esta variable para determinar si mostrar opciones avanzadas
  get showAdvancedTypes(): boolean {
    return this.workout.nivelDificultad !== 'principiante';
  }

  // Propiedades del modal para confirmaciones
  modalVisible = false;
  modalTitle = '';
  modalMessage = '';
  modalAction: (() => void) | null = null;

  constructor(
    private dialog: MatDialog,
    private workoutService: WorkoutService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.workoutId = id;
    this.workoutService.workouts$.pipe(take(1)).subscribe((workouts) => {
      const found = workouts.find((w) => w.id === id);
      if (found) {
        this.workout = found;
      } else {
        console.error('Rutina no encontrada para ID:', id);
      }
      // Si la rutina no tiene nombre (nueva), lo genera automáticamente
      if (!this.workout.nombre) {
        this.actualizarNombreRutinaPorGrupo(this.newExercise.grupoMuscular);
      }
      this.cdr.detectChanges();
    });
  }

  // Crea un objeto Ejercicio vacío (reset)
  createEmptyExercise(): Ejercicio {
    return {
      id: Date.now(),
      nombre: '',
      grupoMuscular: 'otros',
      tipo: 'compuesto',
      // Valor por defecto, se puede modificar según configuración
      tipos: 'back-set',
      series: 0,
      repeticiones: 0,
      descanso: '3 a 5 min',
      pesokg: 0,
      serieCalentamiento: 0,
      repeticionesCalentamiento: 0,
    };
  }

  addExercise(): void {
    // Validación básica
    if (this.newExercise.nombre.trim() && this.newExercise.series > 0) {
      const exerciseCopy: Ejercicio = { ...this.newExercise };
      if (this.editingExerciseIndex !== null) {
        // Editar ejercicio existente
        this.workoutService.editExerciseInWorkout(this.workout.id, this.editingExerciseIndex, exerciseCopy);
        this.editingExerciseIndex = null;
      } else {
        // Agregar nuevo ejercicio
        exerciseCopy.id = Date.now();
        this.workoutService.addExerciseToWorkout(this.workout.id, exerciseCopy);
      }
      this.newExercise = this.createEmptyExercise();
      this.cdr.detectChanges();
    }
  }

  deleteExercise(index: number): void {
    this.showModal(
      'Eliminar ejercicio',
      '¿Estás seguro de que deseas eliminar este ejercicio?',
      () => {
        this.workoutService.deleteExerciseFromWorkout(this.workout.id, index);
        this.cdr.detectChanges();
      }
    );
  }

  editExercise(index: number): void {
    const ejercicio = this.workout.ejercicios[index];
    this.newExercise = { ...ejercicio };
    this.editingExerciseIndex = index;
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editingExerciseIndex = null;
    this.newExercise = this.createEmptyExercise();
    this.cdr.detectChanges();
  }

  saveChanges(): void {
    this.showModal(
      'Guardar rutina',
      '¿Deseas guardar los cambios en la rutina?',
      () => {
        console.log('Rutina guardada:', this.workout);
        this.workoutService.updateWorkout(this.workout);
      }
    );
    this.router.navigate(['/workouts']);
  }

  generarNombreAutomatico(grupo: string): string {
    const rutinasDelGrupo = this.workoutService.getWorkoutsByGrupo(grupo);
    const frecuencia = rutinasDelGrupo.length + 1;
    return `${grupo.charAt(0).toUpperCase() + grupo.slice(1)} F${frecuencia}`;
  }

  actualizarNombreRutinaPorGrupo(grupo: string): void {
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

  // Métodos del modal de confirmación
  showModal(title: string, message: string, onConfirm: () => void): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalAction = onConfirm;
    this.modalVisible = true;
  }
  cancelModal(): void {
    this.modalVisible = false;
    this.modalAction = null;
  }
  confirmModal(): void {
    if (this.modalAction) {
      this.modalAction();
    }
    this.cancelModal();
  }

  getDelayClass(index: number): string {
    return `delay-[${index * 100}ms]`;
  }

  // Opciones Avanzadas:
  addGenericSuperSet(): void {
    // Crea y agrega una super serie a la rutina
    const superSet: Ejercicio = {
      id: Date.now(),
      nombre: 'Super Serie',
      grupoMuscular: 'otros',
      tipo: 'compuesto',
      tipos: 'super-serie',
      series: 4,
      repeticiones: 0,
      descanso: '3 a 5 min',
      pesokg: 0,
      serieCalentamiento: 0,
      repeticionesCalentamiento: 0,
    };
    this.workout.ejercicios.push(superSet);
    this.workoutService.updateWorkout(this.workout);
    this.cdr.detectChanges();
  }



  
  addSuperSet(index: number): void {
    // Ejemplo de agregar super serie vinculando con otro ejercicio.
    // Puedes personalizar qué ejercicio vincular o pedirlo al usuario.
    const ejercicioVinculado: Ejercicio = {
      
      id: Date.now(),
      nombre: 'Polea Pecho',
      grupoMuscular: 'pecho',
      tipo: 'aislado',
      series: 3,
      repeticiones: 15,
      pesokg: 50,
      dificultad: 'baja',
      serieCalentamiento: 0,
      repeticionesCalentamiento: 0
    };
       // Solo se permiten configuraciones avanzadas para rutinas intermedio/avanzado
       if (this.workout.nivelDificultad === 'principiante') {
        console.warn('La rutina es de nivel principiante, configuración avanzada no permitida.');
        return;
      }
    this.workoutService.addSuperSetToExercise(this.workoutId, index, ejercicioVinculado);
    this.cdr.detectChanges();
  }


  // Método para eliminar un super set de un ejercicio específico
  removerSuperSet(index: number): void {
    if (index === null || index < 0) {
      console.error('Índice de ejercicio inválido');
      return;
    }
    
    const ejercicio = this.workout.ejercicios[index];
    if (ejercicio.superSetEjercicio) {
      delete ejercicio.superSetEjercicio;
      // Opcional: Si deseas restablecer el tipo a lo que tenía originalmente:
      ejercicio.tipos = undefined;
      this.workoutService.updateWorkout(this.workout);
      this.cdr.detectChanges();
    } else {
      console.warn('No hay super set configurado en este ejercicio.');
    }
  }

  editarSuperSet(index: number): void {
    const ejercicio = this.workout.ejercicios[index];
    if (!ejercicio.superSetEjercicio) {
      console.warn('No hay super set para editar en este ejercicio.');
      return;
    }
  
    const dialogRef = this.dialog.open(EditarSuperSetModalComponent, {
      data: ejercicio.superSetEjercicio,
      width: '400px',
    });
  
    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado) {
        this.workout.ejercicios[index].superSetEjercicio = resultado;
        this.workoutService.updateWorkout(this.workout);
        this.cdr.detectChanges();
      }
    });
  }
    


     addDropsetAvanzado(index: number): void {
    if (index === null || index < 0) {
      console.error('Índice de ejercicio inválido');
      return;
    }
    const ejercicio = this.workout.ejercicios[index];
    
    // Solo se permiten configuraciones avanzadas para rutinas intermedio/avanzado
    if (this.workout.nivelDificultad === 'principiante') {
      console.warn('La rutina es de nivel principiante, configuración avanzada no permitida.');
      return;
    }

    if (!ejercicio.pesokg) {
      console.warn('No se puede configurar drop set sin peso definido');
      return;
    }

    ejercicio.tipos = 'drop-set';
    
    const baseReps = ejercicio.repeticiones;
    const basePeso = ejercicio.pesokg;
  
    ejercicio.dropSet = {
      sets: [
        { porcentaje: 1.0, repeticiones: baseReps },      // Set base 
        { porcentaje: 0.8, repeticiones: baseReps + 4},  // Primer drop
        { porcentaje: 0.6, repeticiones: baseReps + 8 },  // Segundo drop
      ],
    };
  
    // Opcional: si deseas recalcular la 'vista principal' del ejercicio (ejercicio.repeticiones y ejercicio.pesokg)
    // Podrías dejarlo en la base, o ajustarlo al primer drop, etc.
    // ejercicio.repeticiones = baseReps + 4;
    // ejercicio.pesokg = basePeso * 0.8;
  
    this.workout.ejercicios[index] = ejercicio;
    this.workoutService.updateWorkout(this.workout);
}

removerDropSet(index: number): void {
  if (index === null || index < 0) {
    console.error('Índice de ejercicio inválido');
    return;
  }
  const ejercicio = this.workout.ejercicios[index];
  if (ejercicio.dropSet) {
    delete ejercicio.dropSet;
    // Opcional: Si deseas, puedes restablecer también otros parámetros del ejercicio
    this.workoutService.updateWorkout(this.workout);
    this.cdr.detectChanges();
  } else {
    console.warn('No hay drop set configurado en este ejercicio.');
  }
}



  toggleExpand(index: number): void {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  actualizarConfiguracionPorNivel(): void {
    const nivel = this.workout.nivelDificultad;
    if (nivel === 'principiante') {
      this.workout.ejercicios.forEach(ejercicio => {
        ejercicio.serieCalentamiento = 2;
        ejercicio.repeticionesCalentamiento = 12;
        ejercicio.repeticiones = 8;
        ejercicio.series = 3;
        ejercicio.descanso = '3 a 5 min';
      });
    } else if (nivel === 'intermedio') {
      this.workout.ejercicios.forEach(ejercicio => {
        ejercicio.series = 4;
        ejercicio.descanso = '90 seg';
      });
    } else if (nivel === 'avanzado') {
      this.workout.ejercicios.forEach(ejercicio => {
        ejercicio.series = 5;
        ejercicio.descanso = '3 a 5 min';
      });
    }
    this.cdr.detectChanges();
  }
}
