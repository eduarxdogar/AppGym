import { Component, OnInit, ViewChild, input, effect, inject, computed } from '@angular/core';
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
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { ProgressChartComponent } from '../../shared/ui/progress-chart/progress-chart.component';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

@Component({
  selector: 'app-workout-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, TimerComponent, ExerciseTimerComponent, UiButtonComponent, UiCardComponent, SafeUrlPipe],
  templateUrl: './workout-detail.component.html',
})
export class WorkoutDetailComponent implements OnInit {
  // Input signal automatically bound to route param ':id'
  // Angular Casts to string by default, we can transform it
  // Input signal required
  id = input.required<string>();
  
  // Refactor: workout is now a Signal unpacked from the service
  workout = computed(() => {
    const currentId = this.id();
    // Unwrap the signal from the service
    const workoutSignal = this.workoutService.getWorkoutById(currentId);
    return workoutSignal();
  });

  showTimer = false;
  pesoTotal = 0;
  fechaInicio?: Date;
  fechaFin?: Date;
  @ViewChild(TimerComponent) timerComponent!: TimerComponent;
  expandedIndex: number | null = null;
  
  private workoutService = inject(WorkoutService);
  public router = inject(Router);
  private trainingSessionService = inject(TrainingSessionService);
  private trainingHistoryService = inject(TrainingHistoryService);

  constructor() {
    // Removed manual effect for workout loading since 'workout' is now a computed signal
    effect(() => {
        const w = this.workout();
        if (w) {
            console.log("Rutina cargada (Signal):", w);
        } else {
            console.log("Rutina no encontrada o cargando...");
        }
    });
  }

  ngOnInit(): void {
  }
  
  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  iniciarRutina() {
    const w = this.workout();
    if (w) {
      this.fechaInicio = new Date();
      this.showTimer = true;
      this.pesoTotal = this.calcularPesoTotal();

      if (this.timerComponent) {
        this.timerComponent.start();
      }

      this.trainingSessionService.startSession(w);
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
    const w = this.workout();
    return w?.ejercicios.reduce((total: number, ejercicio: any) => {
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
    const w = this.workout();
    if (w) {
      const ejercicio = w.ejercicios[index];
      console.log("Editar ejercicio:", ejercicio);
      // Por ejemplo, navegar a un componente de edición específico:
      this.router.navigate(['/edit-exercise', w.id, index]);
    }
  }

  deleteExercise(index: number): void {
    const w = this.workout();
    if (w) {
      const confirmado = confirm('¿Estás seguro de eliminar este ejercicio?');
      if (confirmado) {
        this.workoutService.deleteExerciseFromWorkout(w.id, index);
        // Refresh local workout if needed, though signal handles broader state. 
        // Signal updates automatically.
        console.log("Ejercicio eliminado.");
      }
    }
  }

  // Getter para la sesión actual (para binding en el template)
  get currentSession(): TrainingSession | null {
    return this.trainingSessionService.getCurrentSession();
  }

  getVideoEmbedUrl(videoUrl: string | undefined): string {
    if (!videoUrl) return '';
    
    // Extract ID from youtube.com/watch?v= or youtu.be/
    let videoId = '';
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = videoUrl.match(regex);
    
    if (match && match[1]) {
        videoId = match[1];
    }
    
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    
    return ''; // Return empty if invalid to handle in template
  }
}
