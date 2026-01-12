import { Component, OnInit, ViewChild, input, effect, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, doc } from '@angular/fire/firestore';
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

import { WorkoutSession, WorkoutSessionExercise, WorkoutSessionSet } from '../../models/workout-session.model';

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
  private firestore = inject(Firestore); // Correct injection context

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

  // Global Timer State (Session)
  sessionSeconds = signal<number>(0);
  sessionInterval: any;
  
  // Rest Timer State
  isResting = signal<boolean>(false); // Toggles Modal
  
  showTimer = false; 
  expandedIndex: number | null = null;
  @ViewChild('restTimer') restTimer!: TimerComponent;
  
  // Computed for UI
  sessionTimeFormatted = computed(() => {
    const totalSeconds = this.sessionSeconds();
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    // Format: "MM:SS" or "HH:MM:SS"
    const pad = (n: number) => n < 10 ? '0'+n : n;
    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    return `${pad(mins)}:${pad(secs)}`;
  });

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
      
      this.startSessionTimer(); // Global timer starts at 0

      this.trainingSessionService.startSession(w);
    }
  }

  async finalizarRutina() {
    if (confirm('¿Guardar Entrenamiento y finalizar sesión?')) {
        this.isActive.set(false);
        this.showTimer = false;
        
        if (this.sessionInterval) clearInterval(this.sessionInterval);
        this.stopRestTimer();
        
        // Save Session Logic
        const workout = this.workout();
        const startTime = this.trainingSessionService.getCurrentSession()?.fechaInicio || new Date(); // Fallback
        
        if (workout) {
             // Map active sets to WorkoutSession structure
             const sessionExercises: WorkoutSessionExercise[] = workout.ejercicios.map((ex, index) => {
                 const sets = this.activeSets().get(index) || [];
                 return {
                     exerciseId: ex.id || index, // Use index if ID missing
                     name: ex.nombre,
                     targetSets: ex.series || 0,
                     sets: sets.map(s => ({
                         weight: s.weight,
                         reps: s.reps,
                         completed: s.completed
                     }))
                 };
             });

             // Collect muscle groups
             const muscles = new Set<string>();
             workout.musculos?.forEach(m => muscles.add(m));
             workout.ejercicios.forEach(ex => {
                 if(ex.grupoMuscular) muscles.add(ex.grupoMuscular);
             });

             const session: WorkoutSession = {
                 id: doc(collection(this.firestore, 'dummy')).id, // Use class property
                 userId: '', 
                 workoutId: workout.id,
                 name: workout.nombre,
                 startTime: startTime.toISOString(),
                 endTime: new Date().toISOString(),
                 duration: this.sessionTimeFormatted(),
                 totalVolume: this.calculateTotalVolume(),
                 musclesWorked: Array.from(muscles),
                 exercises: sessionExercises,
                 feeling: 'good',
                 calories: Math.round((this.sessionSeconds() / 60 * 5) + (this.calculateTotalVolume() * 0.0005))
             };

             await this.trainingHistoryService.addSession(session);
             
             // Clear temp session
             this.trainingSessionService.saveSession(null);
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

  deleteSet(exIndex: number, setIndex: number) {
      if(!confirm('¿Eliminar esta serie?')) return;
      
      const map = new Map(this.activeSets());
      const sets = map.get(exIndex);
      if(sets && sets.length > 0) {
          sets.splice(setIndex, 1);
          map.set(exIndex, sets);
          this.activeSets.set(map);
      }
  }

  toggleSetComplete(exIndex: number, setIndex: number) {
      const map = new Map(this.activeSets());
      const sets = map.get(exIndex);
      if(sets && sets[setIndex]) {
          sets[setIndex].completed = !sets[setIndex].completed;
          map.set(exIndex, sets);
          this.activeSets.set(map); // Trigger update

          // Optional: Start Rest Timer automatically if completed
          if(sets[setIndex].completed) {
              // this.startRestTimer(); // Uncomment if auto-start desired
          }
      }
  }

  // --- GLOBAL TIMER ---
  
  startSessionTimer() {
      if (this.sessionInterval) clearInterval(this.sessionInterval);
      this.sessionSeconds.set(0);
      this.sessionInterval = setInterval(() => {
          this.sessionSeconds.update(v => v + 1);
      }, 1000);
  }

  // --- REST TIMER ---

  openRestTimer() {
      this.isResting.set(true);
      // Wait for ViewChild
      setTimeout(() => {
          if (this.restTimer) this.restTimer.start();
      }, 50);
  }

  closeRestTimer() {
      this.isResting.set(false);
      if (this.restTimer) this.restTimer.pause();
  }

  stopRestTimer() {
      this.closeRestTimer();
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
