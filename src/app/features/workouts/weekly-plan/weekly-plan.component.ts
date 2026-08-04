import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { WorkoutService } from '../../../core/services/workout.service';
import { TrainerAiService } from '../../../core/services/ai/trainer-ai.service';
import { WeeklyPlanRequest } from '../models/ai-requests.model';
import { UserProfile } from '../../account/models/user-profile.model';
import { UserProfileStateService } from '../../../core/services/user-profile-state.service';
import { RecoveryService } from '../../../core/services/recovery.service';
import { ToastService } from '../../../core/services/toast.service';
import { WeeklySummaryModalComponent } from '../../../shared/components/weekly-summary-modal/weekly-summary-modal.component';
import { ProgressionEngineService } from '../../../core/services/progression-engine.service';
import { ProgressionOptions } from '../models/workout.model';
import { TrainingHistoryService } from '../../../core/services/training-history.service';
import { WorkoutSession } from '../models/workout-history.model';

@Component({
  selector: 'app-weekly-plan',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, WeeklySummaryModalComponent, DragDropModule],
  templateUrl: './weekly-plan.component.html',
  styles: [`
    .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class WeeklyPlanComponent {
  // Services
  private readonly workoutService = inject(WorkoutService);
  public readonly aiService = inject(TrainerAiService);
  private readonly recoveryService = inject(RecoveryService);
  private readonly profileState = inject(UserProfileStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly progressionEngine = inject(ProgressionEngineService);
  private readonly historyService = inject(TrainingHistoryService);

  // Constants
  levels: Array<'Principiante' | 'Intermedio' | 'Avanzado'> = ['Principiante', 'Intermedio', 'Avanzado'];

  // State
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  
  // Wizard State
  selectedLevel: 'Principiante' | 'Intermedio' | 'Avanzado' | null = null;
  userGoal: string = '';
  daysPerWeek: number = 3;

  private readonly shouldAutoGenerate = signal<boolean>(false);

  // Writable signal for Drag & Drop UI reactivity
  weekWorkouts = signal<any[]>([]);

  constructor() {
    // Sincronizar el local state con el state global (solo cuando cambia la fuente de verdad)
    effect(() => {
      const workouts = [...this.workoutService.workouts()].sort((a,b) =>
         new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime()
      );
      this.weekWorkouts.set(workouts);
    }, { allowSignalWrites: true });

    // AUTO-FILL GENERATOR: Sync with User Profile from Onboarding
    effect(() => {
      const profile = this.profileState.profile();
      if (profile) {
        if (!this.selectedLevel) this.selectedLevel = profile.fitnessLevel;
        if (!this.userGoal) {
          const goalMap: Record<string, string> = {
            'volumen': 'Ganar masa muscular y fuerza.',
            'definicion': 'Definir músculos y perder grasa.',
            'mantenimiento': 'Mantener forma física actual.',
            'perdida_peso': 'Bajar de peso y mejorar condición.'
          };
          this.userGoal = goalMap[profile.goal] || '';
        }
        if (this.daysPerWeek === 3 && profile.availableDays?.length > 0) {
          this.daysPerWeek = Math.min(Math.max(profile.availableDays.length, 2), 6);
        }

        // TRIGGER AUTO-GENERATE: Solo si el flag está activo y el perfil tiene datos de días (indicando carga completa)
        if (this.shouldAutoGenerate() && profile.availableDays?.length > 0) {
          this.shouldAutoGenerate.set(false); // Consumimos el trigger
          this.isLoading.set(true); // Aseguramos spinner activo
          // Pequeño delay para que los signals de arriba (userGoal, selectedLevel) se propaguen
          setTimeout(() => this.generatePlan(), 200);
        }
      }
    });

    // AUTO-GENERATE: Lee el query param y activa el flag
    this.route.queryParamMap.subscribe(params => {
      if (params.get('autoGenerate') === 'true') {
        this.shouldAutoGenerate.set(true);
        // ACTIVACIÓN INMEDIATA DEL SPINNER (visual)
        this.isLoading.set(true);
        // Limpia el param para evitar re-generación al recargar
        this.router.navigate([], { replaceUrl: true, queryParams: {} });
      }
    });

    effect(() => {
      const completed = this.isWeekCompleted();
      // If completed and there are workouts, trigger the summary modal
      if (completed && this.weekWorkouts().length > 0) {
        this.showSummaryModal.set(true);
      }
    }, { allowSignalWrites: true });
  }

  async drop(event: CdkDragDrop<any[]>) {
    if (event.previousIndex === event.currentIndex) return;
    
    // 1. Reordenar visualmente
    const currentList = [...this.weekWorkouts()];
    moveItemInArray(currentList, event.previousIndex, event.currentIndex);
    this.weekWorkouts.set(currentList);
    
    // 2. Extraer todas las fechas ordenadas
    const sortedDates = [...this.workoutService.workouts()]
      .map(w => w.fecha!)
      .sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    
    // 3. Reasignar fechas basadas en el nuevo orden y persistir
    for (let i = 0; i < currentList.length; i++) {
       const workout = currentList[i];
       if (workout.fecha !== sortedDates[i]) {
         workout.fecha = sortedDates[i];
         await this.workoutService.updateWorkout(workout);
       }
    }
    
    this.toastService.showSuccess('Plan reordenado exitosamente.');
  }

  /** Earliest fecha in the current plan — used to scope the summary modal metrics. */
  cycleStartDate = computed<Date>(() => {
    const workouts = this.weekWorkouts();
    if (workouts.length === 0) return new Date();
    return new Date(workouts[0].fecha!);
  });

  /** Latest fecha in the current plan — used to scope the summary modal metrics. */
  cycleEndDate = computed<Date>(() => {
    const workouts = this.weekWorkouts();
    if (workouts.length === 0) return new Date();
    return new Date(workouts.at(-1)!.fecha!);
  });

  completedDaysCount = computed(() => {
    return this.weekWorkouts().filter(w => w.isCompleted === true || w.status === 'completed').length;
  });

  isWeekCompleted = computed(() => {
    const workouts = this.weekWorkouts();
    if (workouts.length === 0) return false;
    return workouts.every(w => w.isCompleted === true || w.status === 'completed');
  });

  // Modal State
  showConfirmModal = signal<boolean>(false);
  showSummaryModal = signal<boolean>(false);
  pendingAction = signal<'delete' | 'reset' | null>(null);
  pendingWorkoutId = signal<string | null>(null);

  // AI State
  isGeneratingDay = signal<boolean>(false);

  // Edit Title & Day State
  editingWorkoutId = signal<string | null>(null);
  editingDayId = signal<string | null>(null);
  editingTitle = '';
  
  weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  startEditTitle(workout: any) {
    this.editingWorkoutId.set(workout.id);
    this.editingTitle = workout.nombre;
  }

  cancelEditTitle() {
    this.editingWorkoutId.set(null);
    this.editingTitle = '';
  }

  async saveTitle(workout: any) {
    const newName = this.editingTitle.trim();
    if (newName && newName !== workout.nombre) {
      try {
        const updatedWorkout = { ...workout, nombre: newName };
        await this.workoutService.updateWorkout(updatedWorkout);
        this.toastService.showSuccess('Título actualizado.');
      } catch (err) {
        console.error('Error al actualizar el título:', err);
        this.toastService.showError('Error al actualizar el título.');
      }
    }
    this.editingWorkoutId.set(null);
  }

  async changeWorkoutDay(workout: any, newDayName: string) {
    try {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const targetDayIndex = days.indexOf(newDayName);
      if (targetDayIndex === -1) return;

      const currentFecha = new Date(workout.fecha);
      const currentDayIndex = currentFecha.getDay();
      
      // Calcular la diferencia de días
      let diff = targetDayIndex - currentDayIndex;
      // Si el día ya pasó o es el mismo, pero queremos moverlo "adelante" en la semana (o simplemente ajustar la fecha)
      // Para este MVP, ajustamos a la fecha más cercana con ese día de la semana.
      const newDate = new Date(currentFecha);
      newDate.setDate(currentFecha.getDate() + diff);

      const updatedWorkout = { ...workout, fecha: newDate.toISOString() };
      await this.workoutService.updateWorkout(updatedWorkout);
      this.toastService.showSuccess(`Cambiado a ${newDayName}`);
    } catch (err) {
      console.error('Error al cambiar el día:', err);
      this.toastService.showError('Error al cambiar el día.');
    } finally {
      this.editingDayId.set(null);
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  goToWorkout(id: string) {
     this.router.navigate(['/workouts', id]);
  }

  deleteWorkout(event: Event, id: string) {
     event.stopPropagation();
     this.pendingAction.set('delete');
     this.pendingWorkoutId.set(id);
     this.showConfirmModal.set(true);
  }

  resetPlan() {
     this.pendingAction.set('reset');
     this.showConfirmModal.set(true);
  }

  forceCloseWeek() {
     this.showSummaryModal.set(true);
  }

  cancelAction() {
     this.showConfirmModal.set(false);
     this.pendingAction.set(null);
     this.pendingWorkoutId.set(null);
  }

  async confirmAction() {
     const action = this.pendingAction();
     this.showConfirmModal.set(false);

     if (action === 'delete' && this.pendingWorkoutId() !== null) {
        await this.workoutService.deleteWorkout(this.pendingWorkoutId()!);
        this.toastService.showSuccess('Día de entrenamiento eliminado.');
     } else if (action === 'reset') {
        const total = this.weekWorkouts().length;
        for(const w of this.weekWorkouts()) {
           if(w.id) await this.workoutService.deleteWorkout(w.id);
        }
        if (total > 0) this.toastService.showInfo('El plan ha sido reseteado.');
     }

     this.cancelAction();
  }

  async doRollover(options: ProgressionOptions) {
    // Artificial delay to simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1800));

    this.showSummaryModal.set(false);

    const previousWeekWorkouts = this.weekWorkouts();

    // ── Build history map: workoutName → sessions[], sorted newest first ────
    // This is the source of truth for the progression engine.
    // One async call here; the engine itself stays pure.
    let historyMap: Map<string, WorkoutSession[]> = new Map();
    try {
      const allSessions = await firstValueFrom(this.historyService.getHistory());
      allSessions.forEach(session => {
        if (!session.nombre) return;
        const key = session.nombre.trim();
        const existing = historyMap.get(key) ?? [];
        existing.push(session);
        historyMap.set(key, existing);
      });
      // Sort each group newest first (by endTime or startTime)
      historyMap.forEach((sessions, key) => {
        const sorted = [...sessions].sort((a: WorkoutSession, b: WorkoutSession) => {
          const ta = new Date(a.endTime ?? a.startTime ?? a.fecha ?? 0).getTime();
          const tb = new Date(b.endTime ?? b.startTime ?? b.fecha ?? 0).getTime();
          return tb - ta; // descending
        });
        historyMap.set(key, sorted);
      });
    } catch (err) {
      console.warn('[WeeklyPlan] Could not load history for progression. Using plan template.', err);
    }

    const newMicrocycle = this.progressionEngine.generateNextMicrocycle(
      previousWeekWorkouts,
      options,
      historyMap
    );

    // Delete old week
    for (const w of previousWeekWorkouts) {
      if (w.id) await this.workoutService.deleteWorkout(w.id);
    }

    // Save new week
    for (const newW of newMicrocycle) {
      await this.workoutService.addWorkout(newW);
    }

    this.toastService.showSuccess('¡Nueva semana planificada con IA Coach! Cargas ajustadas.');
  }

  async addDayWithAI() {
      if (this.isGeneratingDay()) return;
      
      this.isGeneratingDay.set(true);
      
      // Get Real Fatigue
      const fatigueRecord: Record<string, number> = {};
      this.recoveryService.muscleRecoveryStatus().forEach((val, key) => {
          fatigueRecord[key] = val.percentage;
      });

      const userProfile = this.profileState.profile();
      const profile: UserProfile = {
         ...(userProfile || {
           weight: 75,
           height: 180,
           availableDays: ['Cualquiera'], 
           equipment: ['Gym Completo'],
           fitnessLevel: 'Intermedio',
           goal: 'volumen'
         }),
         fatigueLevels: fatigueRecord
      };

      const prompt = "Genera un solo día de entrenamiento para complementar mi rutina actual. Analiza mi fatiga para no sobrecargar músculos exhaustos. Que sea variado e interesante.";

      try {
           const newWorkout = await this.aiService.generateWorkout(prompt, profile);

            // Re-ajustar la fecha basándose en la fecha del último entrenamiento del plan actual, si existe.
            const currentWorkouts = this.weekWorkouts();
            const lastWorkout = currentWorkouts.at(-1);
            if (lastWorkout?.fecha) {
               const newDate = new Date(lastWorkout.fecha);
               newDate.setDate(newDate.getDate() + 1);
               newWorkout.fecha = newDate.toISOString();
            }

           await this.workoutService.addWorkout(newWorkout);
           this.toastService.showSuccess('✨ Nuevo día generado y agregado al plan.');

      } catch (err: any) {
           console.error(err);
           this.toastService.showError(err.message || 'Error al contactar a la IA. Revisa tu conexión.');
      } finally {
           this.isGeneratingDay.set(false);
      }
  }

  async generatePlan() {
     if (!this.selectedLevel || !this.userGoal) return;

     this.isLoading.set(true);
     this.errorMessage.set(null);

     // Get Real Fatigue
     const fatigueRecord: Record<string, number> = {};
     this.recoveryService.muscleRecoveryStatus().forEach((val, key) => {
         fatigueRecord[key] = val.percentage;
     });

     const userProfile = this.profileState.profile();
     
     // ORDENAR LOS DÍAS CRONOLÓGICAMENTE: Evita que la IA genere planes en desorden
     const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
     const sortedDays = userProfile?.availableDays ? [...userProfile.availableDays].sort((a, b) => 
       diasSemana.indexOf(a) - diasSemana.indexOf(b)
     ) : [];

     const request: WeeklyPlanRequest = {
        userPrompt: this.userGoal,
        daysToGenerate: this.daysPerWeek,
        profile: {
           ...(userProfile || {
             weight: 75,
             height: 180,
             availableDays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
             equipment: ['Gym Completo'],
             fitnessLevel: this.selectedLevel,
             goal: 'volumen'
           }),
           availableDays: sortedDays.length > 0 ? sortedDays : (userProfile?.availableDays || []),
           fitnessLevel: this.selectedLevel,
           fatigueLevels: fatigueRecord
        }
     };

     try {
        const plans = await this.aiService.generateWeeklyPlan(request);
        
        for (const plan of plans) {
           await this.workoutService.addWorkout(plan);
        }
        this.toastService.showSuccess('Plan semanal generado satisfactoriamente.');
     } catch (err: any) {
        console.error(err);
        this.errorMessage.set(err.message || 'Error generando el plan. Intenta nuevamente.');
        this.toastService.showError(err.message || 'Ocurrió un error generando el plan.');
     } finally {
        this.isLoading.set(false);
     }
  }
}
