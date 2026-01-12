import { Component, OnInit, ViewChild, input, effect, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TrainingSessionService } from '../../core/services/training-session.service';
import { TrainingHistoryService } from '../../core/services/training-history.service';
import { TimerComponent } from '../../features/timer/timer.component';
import { TrainingSession } from '../../models/training-session.model';
import { FormsModule } from '@angular/forms';

interface WorkoutSet {
  reps: number;
  weight: number;
  completed: boolean;
}

@Component({
  selector: 'app-workout-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, FormsModule, TimerComponent],
  templateUrl: './workout-detail.component.html',
})
export class WorkoutDetailComponent implements OnInit {
  id = input.required<string>();
  
  private workoutService = inject(WorkoutService);
  public router = inject(Router);
  private trainingSessionService = inject(TrainingSessionService);
  private trainingHistoryService = inject(TrainingHistoryService);

  // --- SIGNALS ---
  workout = computed(() => {
    const currentId = this.id();
    return this.workoutService.getWorkoutById(currentId)();
  });

  // Fix NG0100: Computed stable percentages
  musclePercentages = computed(() => {
    const w = this.workout();
    if (!w) return {};
    
    const percentages: Record<string, number> = {};
    const baseMap: Record<string, number> = {
        'Pectorales': 94, 'Deltoides': 83, 'Tríceps': 78,
        'Espalda': 88, 'Bíceps': 91, 'Cuádriceps': 65, 'Isquios': 70
    };

    (w.musculos || []).forEach(m => {
        // Use predefined map or stable random based on char code to ensure consistency without true random
        percentages[m] = baseMap[m] || 70 + (m.charCodeAt(0) % 30); 
    });
    return percentages;
  });

  // Active Mode State
  isActive = signal<boolean>(false);
  activeSets = signal<Map<number, WorkoutSet[]>>(new Map()); // Key: Exercise Index

  showTimer = false; // Legacy, kept for compatibility if needed, but isActive drives UI
  expandedIndex: number | null = null;
  @ViewChild(TimerComponent) timerComponent!: TimerComponent;

  constructor() {
    // Initialize sets when workout loads
    effect(() => {
        const w = this.workout();
        if (w && this.activeSets().size === 0) {
            this.initializeSets(w);
        }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {}

  initializeSets(w: Workout) {
      const initialMap = new Map<number, WorkoutSet[]>();
      w.ejercicios.forEach((ex, index) => {
          const sets: WorkoutSet[] = [];
          const targetSets = ex.series || 3;
          for(let i=0; i<targetSets; i++) {
              sets.push({ 
                  reps: ex.repeticiones || 10, 
                  weight: ex.pesokg || 0, 
                  completed: false 
              });
          }
          initialMap.set(index, sets);
      });
      this.activeSets.set(initialMap);
  }

  // --- ACTIONS ---

  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  iniciarRutina() {
    const w = this.workout();
    if (w) {
      this.isActive.set(true); // Switch UI to Active Mode
      this.showTimer = true;
      
      // Allow view to update then start timer
      setTimeout(() => {
          if (this.timerComponent) this.timerComponent.start();
      }, 100);

      this.trainingSessionService.startSession(w);
    }
  }

  finalizarRutina() {
    if (confirm('¿Terminar entrenamiento?')) {
        this.isActive.set(false);
        this.showTimer = false;
        
        if (this.timerComponent) this.timerComponent.pause();
        
        // Save Session Logic
        const session = this.trainingSessionService.getCurrentSession();
        if (session) {
            session.fechaFin = new Date();
            session.duracion = this.timerComponent ? this.timerComponent.timeFormatted : '00:00';
            session.pesoTotal = this.calculateTotalVolume();
            this.trainingSessionService.saveSession(session);
            this.trainingHistoryService.addSession(session);
        }
        
        this.router.navigate(['/dashboard']);
    }
  }

  // --- SETS MANAGEMENT ---

  getSetsForExercise(index: number): WorkoutSet[] {
      return this.activeSets().get(index) || [];
  }

  addSet(index: number) {
      const map = new Map(this.activeSets());
      const current = map.get(index) || [];
      // Copy last set values active
      const last = current.length > 0 ? current[current.length-1] : { reps: 0, weight: 0, completed: false };
      
      current.push({ ...last, completed: false });
      map.set(index, current);
      this.activeSets.set(map);
  }

  toggleSetComplete(exIndex: number, setIndex: number) {
      const map = new Map(this.activeSets());
      const sets = map.get(exIndex);
      if(sets && sets[setIndex]) {
          sets[setIndex].completed = !sets[setIndex].completed;
          map.set(exIndex, sets);
          this.activeSets.set(map); // Trigger update
      }
  }

  // --- HELPERS ---

  calculateTotalVolume(): number {
      let total = 0;
      this.activeSets().forEach(sets => {
          sets.forEach(s => {
              if(s.completed) total += (s.reps * s.weight);
          });
      });
      return total;
  }

  goBack(): void {
    if(this.isActive()) {
        if(confirm('¿Salir del modo entrenamiento?')) {
            this.isActive.set(false);
        }
    } else {
        this.router.navigate(['/dashboard']); 
    }
  }

  getVideoEmbedUrl(videoUrl: string | undefined): string {
    if (!videoUrl) return '';
    let videoId = '';
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = videoUrl.match(regex);
    if (match && match[1]) videoId = match[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  }
}
