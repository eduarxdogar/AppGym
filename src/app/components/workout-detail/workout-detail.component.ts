import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TrainingSessionService } from '../../core/services/training-session.service';
import { TrainingHistoryService } from '../../core/services/training-history.service';
import { TimerComponent } from '../../features/timer/timer.component';
import {ExerciseTimerComponent} from '../../features/exercise-timer/exercise-timer.component';
import { TrainingSession } from '../../models/training-session.model';

@Component({
  selector: 'app-workout-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, TimerComponent,ExerciseTimerComponent],
  templateUrl: './workout-detail.component.html',
})
export class WorkoutDetailComponent implements OnInit {
  workout?: Workout;
  showTimer = false;
  pesoTotal = 0;
  fechaInicio?: Date;
  fechaFin?: Date;
  @ViewChild(TimerComponent) timerComponent!: TimerComponent;
  expandedIndex: number | null = null;


  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    private trainingSessionService: TrainingSessionService,
    private trainingHistoryService: TrainingHistoryService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    console.log("ID recibido:", id);
    this.workout = this.workoutService.getWorkoutById(id);
    console.log("Rutina obtenida:", this.workout);

    if (!this.workout) {
      console.error("Rutina no encontrada para ID:", id);
    }
  }
  
  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }
  iniciarRutina() {
    if (this.workout) {
      this.fechaInicio = new Date();
      this.showTimer = true;
      this.pesoTotal = this.calcularPesoTotal();

      if (this.timerComponent) {
        this.timerComponent.start();
      }

      this.trainingSessionService.startSession(this.workout);
      console.log("Sesión iniciada:", this.trainingSessionService.getCurrentSession());
    }
  }

  finalizarRutina() {
    this.fechaFin = new Date();
    if (this.timerComponent) {
      this.timerComponent.pause();
    }
    const duracion = this.timerComponent ? this.timerComponent.timeFormatted : '00:00';
    const session = this.trainingSessionService.getCurrentSession();
    if (session) {
      // Actualiza la sesión finalizada con fecha fin, duración y peso total
      session.fechaFin = this.fechaFin;
      session.duracion = duracion;
      session.pesoTotal = this.pesoTotal;
      
      // Guarda la sesión actualizada en el TrainingSessionService
      this.trainingSessionService.saveSession(session);
      // Agrega la sesión al historial
      this.trainingHistoryService.addSession(session);
      
      console.log("Sesión finalizada y guardada en historial:", session);
    }
    this.showTimer = false;
  }

  calcularPesoTotal(): number {
    return this.workout?.ejercicios.reduce((total, ejercicio) => {
      const peso = ejercicio.pesokg ?? 0;
      const series = ejercicio.series ?? 0; // por si no hay series, cuenta al menos 1
      return total + (peso * series);
    }, 0) || 0;
  }



  // Método para animaciones (delay basado en el índice)
  getDelayClass(index: number): string {
    const delay = index * 100;
    return `delay-[${delay}ms]`;
  }

  // Métodos para editar y eliminar ejercicios
  editExercise(index: number): void {
    if (this.workout) {
      const ejercicio = this.workout.ejercicios[index];
      console.log("Editar ejercicio:", ejercicio);
      // Por ejemplo, navegar a un componente de edición específico:
      this.router.navigate(['/edit-exercise', this.workout.id, index]);
    }
  }

  deleteExercise(index: number): void {
    if (this.workout) {
      const confirmado = confirm('¿Estás seguro de eliminar este ejercicio?');
      if (confirmado) {
        this.workout.ejercicios.splice(index, 1);
        console.log("Ejercicio eliminado. Lista actualizada:", this.workout.ejercicios);
      }
    }
  }

  // Getter para la sesión actual (para binding en el template)
  get currentSession(): TrainingSession | null {
    return this.trainingSessionService.getCurrentSession();
  }
}
