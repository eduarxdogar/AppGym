import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { WorkoutService } from '../services/workout.service';
import { TrainerAiService } from '../services/trainer-ai.service';
import { WeeklyPlanRequest } from '../models/ai-requests.model';
import { UserProfile } from '../../account/models/user-profile.model';
import { UserProfileStateService } from '../../account/services/user-profile-state.service';
import { RecoveryService } from '../../metrics/services/recovery.service';
import { ToastService } from '../../../core/services/toast.service';
import { WeeklySummaryModalComponent } from '../../../shared/components/weekly-summary-modal/weekly-summary-modal.component';
import { ProgressionEngineService } from '../services/progression-engine.service';
import { ProgressionOptions, Workout } from '../models/workout.model';
import { TrainingHistoryService } from '../services/training-history.service';

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
    // PREVENCIÓN DE GHOST DATA: Forzamos el estado limpio al inicializar
    this.weekWorkouts.set([]);

    // Sincronizar el local state con el state global (solo cuando cambia la fuente de verdad)
    effect(() => {
      const workouts = [...this.workoutService.workouts()].sort((a,b) =>
         new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime()
      );
      this.weekWorkouts.set(workouts);
    });

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
    });
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

  // Summary Stats Computed
  summaryCompletedDays = computed(() => {
    try {
      const workouts = this.weekWorkouts();
      if (!Array.isArray(workouts)) return 0;
      return workouts.filter(w => w && (w.isCompleted === true || w.status === 'completed')).length || 0;
    } catch (err) {
      console.error("Error calculating summaryCompletedDays", err);
      return 0;
    }
  });

  summaryTotalVolume = computed(() => {
    const workouts = this.weekWorkouts();
    try {
      if (!Array.isArray(workouts)) return 0;
      let vol = 0;
      for (const w of workouts) {
        const exercises = w?.exercises || w?.ejercicios;
        if (!Array.isArray(exercises)) continue;
        for (const ex of exercises) {
          const sets = ex?.sets || ex?.series;
          if (!Array.isArray(sets)) continue;
          for (const set of sets) {
            const isSetDone = set.completed === true || set.isCompleted === true || set.checked === true;
            if (set && isSetDone) {
              const reps = Number(set.reps || set.repeticiones || 0);
              const weight = Number(set.weight || set.peso || set.pesokg || 0);
              if (!isNaN(reps) && !isNaN(weight)) {
                vol += (reps * weight);
              }
            }
          }
        }
      }
      return vol;
    } catch (err) {
      console.error("Error calculating summaryTotalVolume", err);
      return 0;
    }
  });

  summaryExercisesCompleted = computed(() => {
    try {
      const workouts = this.weekWorkouts();
      if (!Array.isArray(workouts)) return 0;
      let count = 0;
      for (const w of workouts) {
        const exercises = w?.exercises || w?.ejercicios;
        if (!Array.isArray(exercises)) continue;
        for (const ex of exercises) {
          const sets = ex?.sets || ex?.series;
          if (!Array.isArray(sets)) continue;
          let hasCompletedSet = false;
          for (const set of sets) {
            const isSetDone = set.completed === true || set.isCompleted === true || set.checked === true;
            if (set && isSetDone) {
              hasCompletedSet = true;
              break;
            }
          }
          if (hasCompletedSet) count++;
        }
      }
      return count;
    } catch (err) {
      console.error("Error calculating summaryExercisesCompleted", err);
      return 0;
    }
  });

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
    this.showSummaryModal.set(false);
    this.isLoading.set(true);

    try {
      const previousWeekWorkouts = this.weekWorkouts();
      let newMicrocycle: Workout[] = [];

      switch (options.action) {
        case 'IA_SOBRECARGA':
        case 'IA_CONSOLIDAR':
        case 'IA_DESCARGA': {
          const userProfile = this.profileState.profile();
          const fatigueRecord: Record<string, number> = {};
          this.recoveryService.muscleRecoveryStatus().forEach((val, key) => fatigueRecord[key] = val.percentage);

          let promptStr = '';
          if (options.action === 'IA_SOBRECARGA') promptStr = `Aplica SOBRECARGA (+2.5%) priorizando ${options.focus === 'weight' ? 'PESO (KG)' : 'REPETICIONES'}.`;
          else if (options.action === 'IA_DESCARGA') promptStr = `Aplica DESCARGA (-10%). Reduce cargas para recuperación.`;
          else promptStr = `CONSOLIDAR. Mantén los pesos exactos del historial para mejorar técnica.`;

          const request: WeeklyPlanRequest = {
            userPrompt: promptStr,
            daysToGenerate: previousWeekWorkouts.length,
            profile: {
              ...(userProfile || { weight: 75, height: 180, equipment: ['Gym Completo'], fitnessLevel: 'Intermedio', goal: 'volumen' }),
              availableDays: userProfile?.availableDays || [],
              fatigueLevels: fatigueRecord
            }
          };

          newMicrocycle = await this.aiService.generateWeeklyPlan(request);
          break;
        }
        case 'MANTENER_PLAN': {
          const today = new Date();
          newMicrocycle = previousWeekWorkouts.map((w, index) => {
            const workoutDate = new Date(today);
            workoutDate.setDate(today.getDate() + index);
            return structuredClone({ ...w, id: crypto.randomUUID(), fecha: workoutDate.toISOString() });
          });
          break;
        }
        default:
          throw new Error('Acción no válida');
      }

      // Purificación del Estado de Series (Nueva Semana Limpia)
      newMicrocycle.forEach(workout => {
        workout.isCompleted = false;
        workout.completedAt = undefined;
        workout.status = 'idle';
        if (workout.ejercicios) {
          workout.ejercicios.forEach((ex: any) => {
            if (Array.isArray(ex.series)) {
              ex.series.forEach((s: any) => s.completed = false);
            }
            if (Array.isArray(ex.sets)) {
              ex.sets.forEach((s: any) => s.completed = false);
            }
          });
        }
      });

      // Delete old week
      for (const w of previousWeekWorkouts) {
        if (w.id) await this.workoutService.deleteWorkout(w.id);
      }

      // Save new week
      for (const newW of newMicrocycle) {
        await this.workoutService.addWorkout(newW);
      }

      this.toastService.showSuccess('¡Siguiente microciclo planificado y purificado!');
    } catch (err: any) {
      console.error(err);
      this.toastService.showError('Error al procesar el cambio de semana.');
    } finally {
      this.isLoading.set(false);
    }
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

      const prompt = `Genera un solo día de entrenamiento para complementar mi rutina actual.
ESTADO DE FATIGA ACTUAL: ${JSON.stringify(fatigueRecord)}
INSTRUCCIÓN ESTRICTA: No repitas rutinas ni ejercicios principales de días anteriores cercanos. Analiza estrictamente la fatiga actual y genera el día extra priorizando los grupos musculares más recuperados (menor porcentaje de fatiga).`;

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
