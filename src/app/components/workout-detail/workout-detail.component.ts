import { Component, OnInit, ViewChild, input, effect, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, doc, deleteField } from '@angular/fire/firestore';
import { Workout, ActiveSetState } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';
import { WorkoutService } from '../../core/services/workout.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TrainingSessionService } from '../../core/services/training-session.service';
import { TrainingHistoryService } from '../../core/services/training-history.service';
import { FormsModule } from '@angular/forms';
import { ExerciseImageService } from '../../core/services/exercise-image.service';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { ChatAiService } from '../../core/services/ai/chat-ai.service';
import { RestTimerService, REST_PRESETS_SECONDS } from '../../core/services/rest-timer.service';
import { WorkoutSession, WorkoutSessionExercise } from '../../models/workout-session.model';

interface WorkoutSet {
  reps: number;
  weight: number;
  completed: boolean;
  isDropset?: boolean;
}

@Component({
  selector: 'app-workout-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, FormsModule, SafeUrlPipe],
  templateUrl: './workout-detail.component.html',
})
export class WorkoutDetailComponent implements OnInit {
  id = input.required<string>();
  
  private workoutService        = inject(WorkoutService);
  public  router                = inject(Router);
  private trainingSessionService = inject(TrainingSessionService);
  private trainingHistoryService = inject(TrainingHistoryService);
  private firestore             = inject(Firestore);
  public  exerciseImgService    = inject(ExerciseImageService);
  public  chatService           = inject(ChatAiService);
  public  restTimer             = inject(RestTimerService);

  /** Expose presets for template */
  readonly restPresets = REST_PRESETS_SECONDS;

  // Exercise Detail Modal
  selectedExercise = signal<Ejercicio | null>(null);
  showExerciseModal = signal<boolean>(false);

  openExerciseDetail(ex: Ejercicio) {
    this.selectedExercise.set(ex);
    this.showExerciseModal.set(true);
  }

  closeExerciseModal() {
    this.showExerciseModal.set(false);
    this.selectedExercise.set(null);
  }

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
  activeSets = signal<Map<number, WorkoutSet[]>>(new Map());

  // Global session timer (seconds elapsed)
  sessionSeconds = signal<number>(0);
  private sessionInterval: ReturnType<typeof setInterval> | null = null;

  // --- Modals State ---
  showExitModal         = signal<boolean>(false);
  pendingExitAction     = signal<'exit' | 'save' | null>(null);
  showAddExerciseModal  = signal<boolean>(false);
  newExerciseName       = signal<string>('');
  showRestModal         = signal<boolean>(false);
  expandedIndex: number | null = null;

  // --- Edit-in-place state ---
  editingExerciseIndex  = signal<number | null>(null);
  superserieSourceIndex = signal<number | null>(null);
  showSuperserieModal   = signal<boolean>(false);
  
  // Computed for UI
  sessionTimeFormatted = computed(() => {
    const totalSeconds = this.sessionSeconds();
    const hrs  = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad  = (n: number) => n < 10 ? '0'+n : String(n);
    return hrs > 0
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;
  });

  constructor() {
    // Initialize or restore sets when workout loads
    effect(() => {
        const w = this.workout();
        if (!w) return;

        // Restore persisted session state if present
        if (w.status === 'active' && !this.isActive()) {
            this.restoreActiveSession(w);
        } else if (this.activeSets().size === 0) {
            this.initializeSets(w);
        }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const wid = this.id();
    // Always set active workout context for the coach (loads persisted chat history)
    this.chatService.setActiveWorkout(wid);
  }

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

  /** Restore in-progress session from Firestore persisted state */
  private restoreActiveSession(w: Workout) {
      this.isActive.set(true);

      // Restore elapsed time
      const elapsed = w.activeStartTime
          ? Math.max(0, Math.floor((Date.now() - new Date(w.activeStartTime).getTime()) / 1000))
          : 0;
      this.sessionSeconds.set(elapsed);
      this.startSessionTimer(elapsed); // non-zero → won't reset to 0

      // Restore sets state or fall back to init
      if (w.activeSetsState && Object.keys(w.activeSetsState).length > 0) {
          const restoredMap = new Map<number, WorkoutSet[]>();
          Object.entries(w.activeSetsState).forEach(([key, sets]) => {
              restoredMap.set(Number(key), sets as WorkoutSet[]);
          });
          this.activeSets.set(restoredMap);
      } else {
          this.initializeSets(w);
      }
      this.trainingSessionService.startSession(w);
  }

  // --- ACTIONS ---

  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  iniciarRutina() {
    const w = this.workout();
    if (!w) return;
    this.isActive.set(true);
    this.startSessionTimer();
    this.trainingSessionService.startSession(w);
    // Persist active status + startTime to Firestore
    this.persistWorkoutChanges({
        ...w,
        status: 'active',
        activeStartTime: new Date().toISOString()
    });
  }

  finalizarRutina() {
    this.pendingExitAction.set('save');
    this.showExitModal.set(true);
  }

  async finalizeSession() {
      this.isActive.set(false);
      if (this.sessionInterval) { clearInterval(this.sessionInterval); this.sessionInterval = null; }
      this.restTimer.stop();
      this.showRestModal.set(false);
      
      const workout = this.workout();
      const startTime = this.trainingSessionService.getCurrentSession()?.fechaInicio || new Date();
      
      if (workout) {
           const sessionExercises: WorkoutSessionExercise[] = workout.ejercicios.map((ex, index) => {
               const sets = this.activeSets().get(index) || [];
               return {
                   exerciseId: ex.id || index,
                   name: ex.nombre,
                   targetSets: ex.series || 0,
                   sets: sets.map(s => ({
                       weight: s.weight,
                       reps: s.reps,
                       completed: s.completed
                   }))
               };
           });

           const muscles = new Set<string>();
           workout.musculos?.forEach(m => muscles.add(m));
           workout.ejercicios.forEach(ex => {
               if(ex.grupoMuscular) muscles.add(ex.grupoMuscular);
           });

           const session: WorkoutSession = {
               id: doc(collection(this.firestore, 'dummy')).id,
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

           // Mark workout as completed and clear active session fields
           const updatedWorkout: Workout = {
               ...workout,
               isCompleted: true,
               completedAt: new Date().toISOString(),
               durationMinutes: Math.floor(this.sessionSeconds() / 60),
               status: 'completed',
               activeSetsState: deleteField() as any,
               activeStartTime: deleteField() as any
           };
           await this.workoutService.updateWorkout(updatedWorkout);
           this.trainingSessionService.saveSession(null);
      }
      
      this.router.navigate(['/dashboard']);
  }

  // --- SETS MANAGEMENT ---

  getSetsForExercise(index: number): WorkoutSet[] {
      return this.activeSets().get(index) || [];
  }

  addSet(index: number) {
      const map = new Map(this.activeSets());
      const current = map.get(index) || [];
      const last = current.length > 0 ? current[current.length-1] : { reps: 0, weight: 0, completed: false };
      current.push({ ...last, completed: false, isDropset: false });
      map.set(index, current);
      this.activeSets.set(map);
  }

  addDropSet(exIndex: number) {
      const map = new Map(this.activeSets());
      const current = map.get(exIndex) || [];
      const last = current.length > 0 ? current[current.length-1] : { reps: 0, weight: 0, completed: false };
      // Drop set: 80% del peso, +3-4 reps
      const dropWeight = Math.round((last.weight || 0) * 0.8);
      current.push({ reps: (last.reps || 10) + 3, weight: dropWeight, completed: false, isDropset: true });
      map.set(exIndex, current);
      this.activeSets.set(map);
      this.persistWorkoutChanges();
  }

  deleteSet(exIndex: number, setIndex: number) {
      const map = new Map(this.activeSets());
      const sets = map.get(exIndex);
      if(sets && sets.length > 1) {
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
          this.activeSets.set(map);
          // Persist checks in real-time
          this.persistSetsState();
      }
  }

  /** Serializes activeSets Map to a plain Record for Firestore and persists */
  private async persistSetsState(): Promise<void> {
      const w = this.workout();
      if (!w || !this.isActive()) return;
      const setsRecord: Record<number, WorkoutSet[]> = {};
      this.activeSets().forEach((sets, key) => { setsRecord[key] = sets; });
      await this.persistWorkoutChanges({ ...w, activeSetsState: setsRecord });
  }

  // --- GLOBAL TIMER ---
  
  startSessionTimer(fromSecond: number = 0) {
      if (this.sessionInterval) clearInterval(this.sessionInterval);
      if (fromSecond === 0) this.sessionSeconds.set(0);
      this.sessionInterval = setInterval(() => {
          this.sessionSeconds.update(v => v + 1);
      }, 1000);
  }

  // --- REST TIMER (delegated to RestTimerService) ---

  openRestModal(seconds?: number) {
      if (seconds) this.restTimer.quickStart(seconds);
      else if (!this.restTimer.isRunning()) this.restTimer.start();
      this.showRestModal.set(true);
  }

  closeRestModal() {
      this.showRestModal.set(false);
      // Timer keeps running in the service — no pause on close
  }

  // --- CANCEL SESSION ---

  /** Cancels the active session: clears Firestore status and navigates back */
  async cancelActiveSession(): Promise<void> {
      const w = this.workout();
      if (this.sessionInterval) { clearInterval(this.sessionInterval); this.sessionInterval = null; }
      this.restTimer.stop();
      this.isActive.set(false);
      if (w) {
          await this.persistWorkoutChanges({
              ...w,
              status: 'idle',
              activeStartTime: deleteField() as any,
              activeSetsState: deleteField() as any
          });
      }
      this.trainingSessionService.saveSession(null);
      this.router.navigate(['/dashboard']);
  }

  // --- LIFECYCLE ---

  ngOnDestroy(): void {
      if (this.sessionInterval) {
          clearInterval(this.sessionInterval);
          this.sessionInterval = null;
      }
      // We don't stop restTimer service here because it's global and should persist across views
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

  // --- EXERCISE CRUD (Edit-in-place + Persist) ---

  /** Toggles the inline edit mode for a specific exercise */
  toggleEditExercise(index: number) {
      this.editingExerciseIndex.update(prev => prev === index ? null : index);
  }

  /** Updates a field on an exercise and immediately persists to Firestore */
  async updateExerciseField(exIndex: number, field: keyof Pick<Ejercicio, 'nombre' | 'series' | 'repeticiones' | 'pesokg'>, value: string | number) {
      const w = this.workout();
      if (!w) return;
      const updatedEjercicios = [...w.ejercicios];
      const ex = { ...updatedEjercicios[exIndex] };
      // Type-safe assignment per field
      if (field === 'nombre' && typeof value === 'string') ex.nombre = value;
      if (field === 'series' && typeof value === 'number') {
          ex.series = value;
          // Re-sync local activeSets to match new series count
          const map = new Map(this.activeSets());
          const existing = map.get(exIndex) || [];
          if (value > existing.length) {
              const last = existing[existing.length - 1] ?? { reps: ex.repeticiones, weight: ex.pesokg ?? 0, completed: false };
              for (let i = existing.length; i < value; i++) existing.push({ ...last, completed: false });
          } else {
              existing.splice(value);
          }
          map.set(exIndex, existing);
          this.activeSets.set(map);
      }
      if (field === 'repeticiones' && typeof value === 'number') ex.repeticiones = value;
      if (field === 'pesokg' && typeof value === 'number') ex.pesokg = value;
      updatedEjercicios[exIndex] = ex;
      await this.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  /** Open superset modal for a given source exercise */
  openSuperserieModal(sourceIndex: number) {
      this.superserieSourceIndex.set(sourceIndex);
      this.showSuperserieModal.set(true);
  }

  closeSuperserieModal() {
      this.showSuperserieModal.set(false);
      this.superserieSourceIndex.set(null);
  }

  /** Links two exercises as a superset and persists */
  async linkSuperset(targetIndex: number) {
      const sourceIndex = this.superserieSourceIndex();
      const w = this.workout();
      if (sourceIndex === null || !w || sourceIndex === targetIndex) return;
      const updatedEjercicios = [...w.ejercicios];
      const source = { ...updatedEjercicios[sourceIndex] };
      source.tipos = 'super-serie';
      source.superSetEjercicio = updatedEjercicios[targetIndex];
      updatedEjercicios[sourceIndex] = source;
      await this.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
      this.closeSuperserieModal();
  }

  /** Deletes an exercise from the workout and persists to Firestore */
  async deleteExercise(exIndex: number): Promise<void> {
      const w = this.workout();
      if (!w) return;
      const updatedEjercicios = [...w.ejercicios];
      updatedEjercicios.splice(exIndex, 1);
      // Re-map activeSets: shift keys above deleted index
      const newMap = new Map<number, WorkoutSet[]>();
      this.activeSets().forEach((sets, key) => {
          if (key < exIndex) newMap.set(key, sets);
          else if (key > exIndex) newMap.set(key - 1, sets);
          // key === exIndex is dropped
      });
      this.activeSets.set(newMap);
      await this.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  /** Saves the current workout state to Firestore */
  async persistWorkoutChanges(overrideWorkout?: Workout): Promise<void> {
      const w = overrideWorkout ?? this.workout();
      if (!w) return;
      try {
          await this.workoutService.updateWorkout(w);
      } catch (err) {
          console.error('Error persisting workout changes:', err);
      }
  }

  goBack(): void {
    if(this.isActive()) {
        this.pendingExitAction.set('exit');
        this.showExitModal.set(true);
    } else {
        this.router.navigate(['/dashboard']); 
    }
  }

  // --- Modals Logic ---

  cancelExitModal() {
      this.showExitModal.set(false);
      this.pendingExitAction.set(null);
  }

  async confirmExitModal() {
      const action = this.pendingExitAction();
      this.showExitModal.set(false);
      if (action === 'save') {
          await this.finalizeSession();
      } else if (action === 'exit') {
          this.isActive.set(false);
      }
      this.pendingExitAction.set(null);
  }

  openAddExerciseModal() {
      this.newExerciseName.set('');
      this.showAddExerciseModal.set(true);
  }

  closeAddExerciseModal() {
      this.showAddExerciseModal.set(false);
  }

  saveNewExercise() {
      const name = this.newExerciseName().trim();
      if (!name) return;

      const w = this.workout();
      if(w) {
          const wObj = Object.assign({}, w);
          // Insert minimal exercise
          wObj.ejercicios.push({
              id: Date.now(),
              nombre: name,
              grupoMuscular: 'General',
              tipo: 'aislado',
              series: 3,
              repeticiones: 10,
              descanso: '60s',
              pesokg: 0,
              notas: 'Agregado manualmente'
          });

          // Re-initialize active set just for this new index
          const newIndex = wObj.ejercicios.length - 1;
          const map = new Map(this.activeSets());
          
          const targetSets = 3;
          const sets: WorkoutSet[] = [];
          for(let i=0; i<targetSets; i++) {
              sets.push({ reps: 10, weight: 0, completed: false });
          }
          
          map.set(newIndex, sets);
          this.activeSets.set(map);

          this.closeAddExerciseModal();
          this.expandedIndex = newIndex; // Auto expand to let the user see it
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
