import { Component, OnInit, input, effect, inject, computed, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Ejercicio } from '../models/ejercicio.model';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ExerciseImageService } from '../../../core/services/exercise-image.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { SafeYoutubePipe } from '../../../shared/pipes/safe-youtube.pipe';
import { ChatAiService } from '../../../core/services/ai/chat-ai.service';
import { RecoveryService } from '../../../core/services/recovery.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ToastService } from '../../../core/services/toast.service';
import { UserProfileStateService } from '../../../core/services/user-profile-state.service';
import { WorkoutSessionService, WorkoutSet } from './services/workout-session.service';

import { WorkoutHeaderComponent } from './components/workout-header/workout-header.component';
import { ExerciseCardComponent } from './components/exercise-card/exercise-card.component';
import { SetTrackerComponent } from './components/set-tracker/set-tracker.component';
import { RestTimerComponent } from './components/rest-timer/rest-timer.component';

@Component({
  selector: 'app-workout-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatIconModule, FormsModule, SafeYoutubePipe, DragDropModule,
    WorkoutHeaderComponent, ExerciseCardComponent, SetTrackerComponent, RestTimerComponent
  ],
  templateUrl: './workout-detail.component.html',
})
export class WorkoutDetailComponent implements OnInit {
  id = input.required<string>();
  
  public  readonly router                = inject(Router);
  public  readonly exerciseImgService    = inject(ExerciseImageService);
  public  readonly exerciseService       = inject(ExerciseService);
  public  readonly chatService           = inject(ChatAiService);
  private readonly recoveryService       = inject(RecoveryService);
  private readonly toastService          = inject(ToastService);
  private readonly userProfileState      = inject(UserProfileStateService);
  
  public readonly sessionService = inject(WorkoutSessionService);

  // Modals & UI State
  selectedExercise = signal<Ejercicio | null>(null);
  showExerciseModal = signal<boolean>(false);
  showExitModal         = signal<boolean>(false);
  pendingExitAction     = signal<'exit' | 'save' | 'cancel' | null>(null);
  expandedIndex: number | null = null;
  
  showFatigueWarning    = signal<boolean>(false);
  fatiguedMusclesDesc   = signal<string>('');
  fatiguedAverage       = signal<number>(0);
  
  catalogModalMode = signal<'superset' | 'add-manual' | null>(null);
  showCatalogModal = signal<boolean>(false);
  superserieSourceIndex = signal<number | null>(null);
  supersetSearchQuery = signal<string>('');
  supersetSelectedMuscle = signal<string | null>(null);

  supersetMuscleGroups = signal<string[]>([
      'pecho', 'espalda', 'bíceps', 'tríceps', 'hombros', 
      'cuádriceps', 'isquios', 'glúteos', 'gemelos', 'core'
  ]);

  userEquipment = computed(() => this.userProfileState.profile()?.equipment || []);
  workout = this.sessionService.workout;
  isActive = this.sessionService.isActive;

  musclePercentages = computed(() => {
    const w = this.workout();
    if (!w) return {};
    const statusMap = this.recoveryService.getMuscleRecoveryStatus()();
    const percentages: Record<string, number> = {};
    (w.musculos || []).forEach(m => {
      const normalizedM = m.toLowerCase().trim();
      let found: number | undefined;
      statusMap.forEach((status, key) => {
        if (
          key.toLowerCase() === normalizedM ||
          status.name.toLowerCase() === normalizedM ||
          status.name.toLowerCase().includes(normalizedM) ||
          normalizedM.includes(status.name.toLowerCase())
        ) {
          found = status.percentage;
        }
      });
      percentages[m] = found ?? 100;
    });
    return percentages;
  });

  activeModalMetrics = computed(() => {
    const ex = this.selectedExercise();
    const w = this.workout();
    if (!ex || !w) return null;
    const index = w.ejercicios.findIndex(e => e.nombre === ex.nombre);
    if (index === -1) return null;
    const sets = this.sessionService.getSetsForExercise(index);
    if (sets.length === 0) return null;
    const completedSets = sets.filter(s => s.completed);
    let currentKg = sets[0].weight || 0;
    let currentReps = sets[0].reps || 0;
    if (completedSets.length > 0) {
      currentKg = completedSets.at(-1)!.weight;
      currentReps = completedSets.at(-1)!.reps;
    }
    return {
      seriesCompletadas: completedSets.length,
      totalSeries: sets.length,
      currentKg,
      currentReps
    };
  });

  filteredSupersetExercises = computed(() => {
      let exs = this.exerciseService.getAll();
      const muscle = this.supersetSelectedMuscle();
      const q = this.supersetSearchQuery().toLowerCase();

      if (muscle) exs = exs.filter(e => e.grupoMuscular.toLowerCase() === muscle.toLowerCase());
      if (q) exs = exs.filter(e => e.nombre.toLowerCase().includes(q));
      
      return exs.sort((a, b) => {
          const aHas = this.hasRequiredEquipment(a);
          const bHas = this.hasRequiredEquipment(b);
          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;
          return 0;
      });
  });

  constructor() {
    effect(() => {
        const wid = this.id();
        if (wid) {
            this.sessionService.loadWorkout(wid);
        }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const wid = this.id();
    this.chatService.setActiveWorkout(wid);
  }

  hasRequiredEquipment(ex: Ejercicio): boolean {
      if (!ex.equipmentRequired || ex.equipmentRequired.length === 0) return true;
      const userEq = this.userEquipment();
      return ex.equipmentRequired.every(eq => eq === 'Calistenia' || userEq.includes(eq));
  }

  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  openExerciseDetail(ex: Ejercicio) {
    this.selectedExercise.set(ex);
    this.showExerciseModal.set(true);
  }

  closeExerciseModal() {
    this.showExerciseModal.set(false);
    this.selectedExercise.set(null);
  }

  iniciarRutina() {
    const w = this.workout();
    if (!w) return;
    const muscles = new Set<string>();
    w.musculos?.forEach(m => muscles.add(m));
    w.ejercicios.forEach(ex => {
        if(ex.grupoMuscular) muscles.add(ex.grupoMuscular);
    });

    const statusMap = this.recoveryService.getMuscleRecoveryStatus()();
    let totalFatigue = 0;
    let countedMuscles = 0;
    const veryFatiguedNames: string[] = [];
    let anyUnder48h = false;

    muscles.forEach(mName => {
        const status = Array.from(statusMap.values()).find(s => 
            s.name.toLowerCase() === mName.toLowerCase() ||
            mName.toLowerCase().includes(s.name.toLowerCase()) ||
            s.name.toLowerCase().includes(mName.toLowerCase())
        );
        if (status) {
            totalFatigue += status.percentage;
            countedMuscles++;
            const hoursSince = status.lastWorkoutDate 
                ? (Date.now() - status.lastWorkoutDate.getTime()) / (1000 * 60 * 60) 
                : 999;

            if (status.percentage <= 60 || hoursSince < 48) {
                if (!veryFatiguedNames.includes(status.name)) veryFatiguedNames.push(status.name);
            }
            if (hoursSince < 48) anyUnder48h = true;
        }
    });

    if (countedMuscles > 0) {
        const average = totalFatigue / countedMuscles;
        if (average <= 60 || anyUnder48h) {
            this.fatiguedAverage.set(Math.round(average));
            this.fatiguedMusclesDesc.set(veryFatiguedNames.length > 0 ? veryFatiguedNames.join(', ') : 'Los músculos objetivo');
            this.showFatigueWarning.set(true);
            return;
        }
    }
    this.confirmStartRoutine();
  }

  cancelFatigueWarning() {
      this.showFatigueWarning.set(false);
  }

  confirmStartRoutine() {
    this.showFatigueWarning.set(false);
    this.sessionService.startRoutine();
  }

  finalizarRutina() {
    this.pendingExitAction.set('save');
    this.showExitModal.set(true);
  }

  cancelActiveSession() {
      this.pendingExitAction.set('cancel');
      this.showExitModal.set(true);
  }

  cancelExitModal() {
      this.showExitModal.set(false);
      this.pendingExitAction.set(null);
  }

  async confirmExitModal() {
      const action = this.pendingExitAction();
      this.showExitModal.set(false);
      if (action === 'save') {
          await this.sessionService.finalizeSession();
      } else if (action === 'cancel') {
          this.sessionService.cancelActiveSession();
      }
      this.pendingExitAction.set(null);
  }

  goBack(): void {
    if(this.isActive()) {
        this.cancelActiveSession();
    } else {
        this.router.navigate(['/dashboard']); 
    }
  }

  // Drag and Drop
  drop(event: CdkDragDrop<Ejercicio[]>) {
      const w = this.workout();
      if (!w) return;
      if (event.previousIndex === event.currentIndex) return;

      const updatedEjercicios = [...w.ejercicios];
      moveItemInArray(updatedEjercicios, event.previousIndex, event.currentIndex);

      const currentMap = this.sessionService.activeSets();
      const newMap = new Map();
      const indices = Array.from({length: w.ejercicios.length}, (_, i) => i);
      moveItemInArray(indices, event.previousIndex, event.currentIndex);
      
      for (let newIndex = 0; newIndex < indices.length; newIndex++) {
          const oldIndex = indices[newIndex];
          if (currentMap.has(oldIndex)) {
              newMap.set(newIndex, currentMap.get(oldIndex)!);
          }
      }
      
      this.sessionService.activeSets.set(newMap);
      this.sessionService.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  // Catalog Modals
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

      const safeTarget = structuredClone(targetExercise);
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
          await this.sessionService.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
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
          
          await this.sessionService.persistWorkoutChanges(wObj);
          
          const newIndex = wObj.ejercicios.length - 1;
          const map = new Map(this.sessionService.activeSets());
          
          const targetSets = newExercise.series || 3;
          const sets: WorkoutSet[] = [];
          for(let i=0; i<targetSets; i++) {
              const isWarmup = i < 2;
              sets.push({ type: isWarmup ? 'warmup' : 'effective', reps: newExercise.repeticiones || 10, weight: 0, completed: false, dropSets: [], superReps: undefined, superWeight: undefined });
          }
          if (sets.length === 0) {
              sets.push({ type: 'warmup', reps: 10, weight: 0, completed: false, dropSets: [], superReps: undefined, superWeight: undefined });
          }
          map.set(newIndex, sets);
          this.sessionService.activeSets.set(map);

          this.closeCatalogModal();
          this.expandedIndex = newIndex;
      }
  }

  async unlinkSuperset(data: {exIndex: number, event: Event}) {
      if (data.event) data.event.stopPropagation();
      const w = this.workout();
      if (!w) return;
      const updatedEjercicios = [...w.ejercicios];
      const ex = { ...updatedEjercicios[data.exIndex] };
      ex.superSetEjercicio = null as any;
      ex.tipos = 'aislado' as any;
      updatedEjercicios[data.exIndex] = ex;
      await this.sessionService.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  async updateSupersetField(data: {exIndex: number, field: 'series' | 'repeticiones', value: number}) {
      const w = this.workout();
      if (!w) return;
      const updatedEjercicios = [...w.ejercicios];
      const ex = { ...updatedEjercicios[data.exIndex] };
      if (!ex.superSetEjercicio) return;
      const child = { ...ex.superSetEjercicio };
      
      if (data.field === 'series') child.series = data.value;
      if (data.field === 'repeticiones') child.repeticiones = data.value;
      
      ex.superSetEjercicio = child;
      updatedEjercicios[data.exIndex] = ex;
      await this.sessionService.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  async deleteExercise(exIndex: number) {
      const w = this.workout();
      if (!w) return;
      const updatedEjercicios = [...w.ejercicios];
      updatedEjercicios.splice(exIndex, 1);
      const newMap = new Map();
      this.sessionService.activeSets().forEach((sets, key) => {
          if (key < exIndex) newMap.set(key, sets);
          else if (key > exIndex) newMap.set(key - 1, sets);
      });
      this.sessionService.activeSets.set(newMap);
      await this.sessionService.persistWorkoutChanges({ ...w, ejercicios: updatedEjercicios });
  }

  getVideoEmbedUrl(videoUrl: string | undefined): string {
    if (!videoUrl) return '';
    let videoId = '';
    const regex = /(?:v=|\/embed\/|\/v\/|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = regex.exec(videoUrl);
    videoId = match?.[1] || '';
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  }
}
