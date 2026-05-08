import { Component, OnInit, OnDestroy, input, effect, inject, computed, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Firestore, collection, doc, deleteField } from '@angular/fire/firestore';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';
import { WorkoutService } from '../../core/services/workout.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TrainingSessionService } from '../../core/services/training-session.service';
import { TrainingHistoryService } from '../../core/services/training-history.service';
import { FormsModule } from '@angular/forms';
import { ExerciseImageService } from '../../core/services/exercise-image.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { ChatAiService } from '../../core/services/ai/chat-ai.service';
import { RestTimerService, REST_PRESETS_SECONDS } from '../../core/services/rest-timer.service';
import { WorkoutSession, WorkoutSessionExercise } from '../../models/workout-session.model';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

export interface DropSet {
  reps: number;
  weight: number;
  superReps?: number;
  superWeight?: number;
}

export interface WorkoutSet {
  type?: 'warmup' | 'effective';
  reps: number;
  weight: number;
  completed: boolean;
  dropSets?: DropSet[];
  superReps?: number;
  superWeight?: number;
}

@Component({
  selector: 'app-workout-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, FormsModule, SafeUrlPipe, DragDropModule],
  templateUrl: './workout-detail.component.html',
})
export class WorkoutDetailComponent implements OnInit, OnDestroy {
  id = input.required<string>();
  
  private readonly workoutService        = inject(WorkoutService);
  public  readonly router                = inject(Router);
  private readonly trainingSessionService = inject(TrainingSessionService);
  private readonly trainingHistoryService = inject(TrainingHistoryService);
  private readonly firestore             = inject(Firestore);
  public  readonly exerciseImgService    = inject(ExerciseImageService);
  public  readonly exerciseService       = inject(ExerciseService);
  public  readonly chatService           = inject(ChatAiService);
  public  readonly restTimer             = inject(RestTimerService);

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
        // Use predefined map or stable random based on code point to ensure consistency
        percentages[m] = baseMap[m] || 70 + ((m.codePointAt(0) || 0) % 30); 
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
  pendingExitAction     = signal<'exit' | 'save' | 'cancel' | null>(null);
  showAddExerciseModal  = signal<boolean>(false);
  newExerciseName       = signal<string>('');
  showRestModal         = signal<boolean>(false);
  expandedIndex: number | null = null;

  // --- Edit-in-place state ---
  editingExerciseIndex  = signal<number | null>(null);
  
  // Catalog Modal State
  catalogModalMode = signal<'superset' | 'add-manual' | null>(null);
  showCatalogModal = signal<boolean>(false);
  superserieSourceIndex = signal<number | null>(null);
  supersetSearchQuery = signal<string>('');
  supersetSelectedMuscle = signal<string | null>(null);

  supersetMuscleGroups = signal<string[]>([
      'Pecho', 'Espalda', 'Bíceps', 'Tríceps', 'Hombros', 
      'Cuádriceps', 'Isquios', 'Pantorrilla', 'Core'
  ]);

  filteredSupersetExercises = computed(() => {
      let exs = this.exerciseService.getAll();
      const muscle = this.supersetSelectedMuscle();
      const q = this.supersetSearchQuery().toLowerCase();

      if (muscle) exs = exs.filter(e => e.grupoMuscular === muscle);
      if (q) exs = exs.filter(e => e.nombre.toLowerCase().includes(q));
      
      return exs;
  });
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

  // Reactive progress bar (goal: 60 mins)
  timerProgress = computed(() => {
    const elapsed = this.sessionSeconds();
    const target = 3600;
    const progress = (elapsed / target) * 100;
    return progress > 100 ? 100 : progress;
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
                  type: i < 2 ? 'warmup' : 'effective',
                  reps: ex.repeticiones || 10, 
                  weight: ex.pesokg || 0, 
                  completed: false,
                  dropSets: [],
                  superReps: ex.superSetEjercicio?.repeticiones || 10,
                  superWeight: ex.superSetEjercicio?.pesokg || 0
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
      
      this.router.navigate(['/weekly-plan']);
  }

  // --- SETS MANAGEMENT ---

  getSetsForExercise(index: number): WorkoutSet[] {
      return this.activeSets().get(index) || [];
  }

  addSet(index: number) {
      const map = new Map(this.activeSets());
      const current = map.get(index) || [];
      const last = current.at(-1) ?? { type: 'effective', reps: 0, weight: 0, completed: false, dropSets: [] };
      current.push({ ...last, type: 'effective', completed: false, dropSets: [] });
      map.set(index, current);
      this.activeSets.set(map);
  }

  addDropSet(exIndex: number) {
      const map = new Map(this.activeSets());
      const current = map.get(exIndex) || [];
      
      // Encontrar el último set efectivo (o el último set si no hay efectivos)
      let targetSetIndex = -1;
      for (let i = current.length - 1; i >= 0; i--) {
          if (current[i].type === 'effective' || current[i].type === undefined) {
              targetSetIndex = i;
              break;
          }
      }
      if (targetSetIndex === -1 && current.length > 0) {
          targetSetIndex = current.length - 1;
      }
      
      if (targetSetIndex !== -1) {
          const targetSet = current[targetSetIndex];
          if (!targetSet.dropSets) targetSet.dropSets = [];
          
          const baseForDrop = targetSet.dropSets.length > 0 ? targetSet.dropSets[targetSet.dropSets.length - 1] : targetSet;
          
          const dropWeight = Math.floor((baseForDrop.weight || 0) * 0.8);
          const newReps = (baseForDrop.reps || 10) + 4;
          
          const newDropSet: DropSet = { reps: newReps, weight: dropWeight };
          
          if (baseForDrop.superReps !== undefined) {
              newDropSet.superWeight = Math.floor((baseForDrop.superWeight || 0) * 0.8);
              newDropSet.superReps = (baseForDrop.superReps || 10) + 4;
          }
          
          targetSet.dropSets.push(newDropSet);
      }
      
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
      if(sets?.[setIndex]) {
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
              const last = existing.at(-1) ?? { reps: ex.repeticiones, weight: ex.pesokg ?? 0, completed: false };
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

  /** Updates a field on a linked superset exercise and immediately persists to Firestore */
  async updateSupersetField(exIndex: number, field: 'series' | 'repeticiones', value: number) {
      const w = this.workout();
      if (!w) return;
      const updatedEjercicios = [...w.ejercicios];
      const ex = { ...updatedEjercicios[exIndex] };
      if (!ex.superSetEjercicio) return;
      const child = { ...ex.superSetEjercicio };
      
      if (field === 'series') child.series = value;
      if (field === 'repeticiones') child.repeticiones = value;
      
      ex.superSetEjercicio = child;
      updatedEjercicios[exIndex] = ex;
      await this.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  /** Handles Drag and Drop reordering of exercises */
  drop(event: CdkDragDrop<Ejercicio[]>) {
      const w = this.workout();
      if (!w) return;
      if (event.previousIndex === event.currentIndex) return;

      const updatedEjercicios = [...w.ejercicios];
      moveItemInArray(updatedEjercicios, event.previousIndex, event.currentIndex);

      // Map the activeSets indices to match the new array order
      const currentMap = this.activeSets();
      const newMap = new Map<number, WorkoutSet[]>();
      
      const indices = Array.from({length: w.ejercicios.length}, (_, i) => i);
      moveItemInArray(indices, event.previousIndex, event.currentIndex);
      
      for (let newIndex = 0; newIndex < indices.length; newIndex++) {
          const oldIndex = indices[newIndex];
          if (currentMap.has(oldIndex)) {
              newMap.set(newIndex, currentMap.get(oldIndex)!);
          }
      }
      
      this.activeSets.set(newMap);
      this.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  /** Open superset modal for a given source exercise */
  openSuperserieModal(sourceIndex: number) {
      this.superserieSourceIndex.set(sourceIndex);
      this.supersetSearchQuery.set('');
      this.supersetSelectedMuscle.set(null);
      this.catalogModalMode.set('superset');
      this.showCatalogModal.set(true);
  }

  openAddExerciseModal() {
      this.supersetSearchQuery.set('');
      this.supersetSelectedMuscle.set(null);
      this.catalogModalMode.set('add-manual');
      this.showCatalogModal.set(true);
  }

  closeCatalogModal() {
      this.showCatalogModal.set(false);
      this.catalogModalMode.set(null);
      this.superserieSourceIndex.set(null);
  }

  async selectExerciseFromCatalog(targetExercise: Ejercicio) {
      const mode = this.catalogModalMode();
      const w = this.workout();
      if (!w) return;

      // Sanitización profunda / Deep copy para romper referencias y evitar undefined
      const safeTarget = JSON.parse(JSON.stringify(targetExercise)) as Ejercicio;
      safeTarget.notas = safeTarget.notas || 'Sin instrucciones adicionales.';
      safeTarget.videoUrl = safeTarget.videoUrl || '';
      safeTarget.tipo = safeTarget.tipo || 'aislado';

      if (mode === 'superset') {
          const sourceIndex = this.superserieSourceIndex();
          if (sourceIndex === null) return;
          const updatedEjercicios = [...w.ejercicios];
          const source = { ...updatedEjercicios[sourceIndex] };
          source.tipos = 'super-serie';
          source.superSetEjercicio = safeTarget;
          updatedEjercicios[sourceIndex] = source;
          await this.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
          this.closeCatalogModal();
      } else if (mode === 'add-manual') {
          const newExercise: Ejercicio = {
             ...safeTarget,
             id: Date.now()
          };
          const wObj = { 
            ...w, 
            ejercicios: [
                ...w.ejercicios,
                newExercise
            ]
          };
          
          await this.persistWorkoutChanges(wObj);
          
          const newIndex = wObj.ejercicios.length - 1;
          const map = new Map(this.activeSets());
          
          const targetSets = newExercise.series || 3;
          const sets: WorkoutSet[] = [];
          for(let i=0; i<targetSets; i++) {
              sets.push({ type: i < 2 ? 'warmup' : 'effective', reps: newExercise.repeticiones || 10, weight: 0, completed: false, dropSets: [] });
          }
          // IMPORTANT: Ensure at least one set is initialized to avoid UI/Data undefined bugs
          if (sets.length === 0) {
              sets.push({ type: 'warmup', reps: 10, weight: 0, completed: false, dropSets: [] });
          }
          
          map.set(newIndex, sets);
          this.activeSets.set(map);

          this.closeCatalogModal();
          this.expandedIndex = newIndex; // Auto expand to let the user see it
      }
  }

  /** Removes the superset link from an exercise without deleting it */
  async unlinkSuperset(exIndex: number, event?: Event): Promise<void> {
      if (event) {
          event.stopPropagation();
      }
      const w = this.workout();
      if (!w) return;
      const updatedEjercicios = [...w.ejercicios];
      const ex = { ...updatedEjercicios[exIndex] };
      // Nullify to ensure UI updates instantly and Firestore removes the data
      ex.superSetEjercicio = null as any;
      ex.tipos = 'aislado' as any;
      updatedEjercicios[exIndex] = ex;
      await this.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  /** (Legacy) Links two exercises already in the workout */
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
      this.closeCatalogModal();
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
      } else if (action === 'cancel') {
          const w = this.workout();
          if (w) {
              const updatedW: any = { ...w, status: 'idle' };
              delete updatedW.activeStartTime;
              delete updatedW.activeSetsState;
              await this.workoutService.updateWorkout(updatedW);
              this.trainingSessionService.saveSession(null);
          }
          this.isActive.set(false);
          if (this.sessionInterval) { clearInterval(this.sessionInterval); this.sessionInterval = null; }
          this.restTimer.stop();
          this.router.navigate(['/weekly-plan']);
      }
      this.pendingExitAction.set(null);
  }

  cancelActiveSession() {
      this.pendingExitAction.set('cancel');
      this.showExitModal.set(true);
  }



  getVideoEmbedUrl(videoUrl: string | undefined): string {
    if (!videoUrl) return '';
    let videoId = '';
    // Simple and low-complexity regex for YouTube IDs
    const regex = /(?:v=|\/embed\/|\/v\/|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = regex.exec(videoUrl);
    videoId = match?.[1] || '';
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  }
}
