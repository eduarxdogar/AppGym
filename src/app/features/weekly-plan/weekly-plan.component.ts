import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { WorkoutService } from '../../core/services/workout.service';
import { AiCoachService, WeeklyPlanRequest, UserProfile } from '../../core/services/ai-coach.service';
import { RecoveryService } from '../../core/services/recovery.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-weekly-plan',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, DatePipe],
  template: `
    <div class="min-h-screen bg-[#0B0E14] text-white p-4 pb-24 font-sans animate-fadeIn">
      
      <!-- Header -->
      <div class="flex items-center justify-between mb-8 pt-2 max-w-lg mx-auto">
        <div class="flex items-center gap-4">
            <button (click)="goBack()" class="h-10 w-10 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700 transition border border-zinc-700">
            <mat-icon>arrow_back</mat-icon>
            </button>
            <div>
            <h1 class="text-2xl font-bold tracking-wider uppercase">Tu Plan de {{ weekWorkouts().length }} Días</h1>
            <p class="text-xs text-zinc-500 tracking-widest">AGENDA DE ENTRENAMIENTO</p>
            </div>
        </div>
        
        <div *ngIf="weekWorkouts().length > 0">
           <button (click)="resetPlan()" class="text-red-500 text-xs uppercase font-bold tracking-widest hover:text-red-400 transition" title="Borrar Plan">
              Reset
           </button>
        </div>
      </div>

      <!-- MAIN CONTENT AREA -->
      <div class="max-w-lg mx-auto">

        <!-- LOADING STATE -->
        <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-20 space-y-4">
             <div class="relative h-16 w-16">
                <div class="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-[#CCFF00] rounded-full border-t-transparent animate-spin"></div>
             </div>
             <p class="text-[#CCFF00] font-bold tracking-widest animate-pulse">GENERANDO PLAN...</p>
             <p class="text-zinc-500 text-sm text-center">Analizando biometría y fatiga...</p>
        </div>


        <!-- EMPTY STATE: WIZARD DE GENERACIÓN -->
        <div *ngIf="weekWorkouts().length === 0 && !isLoading()" class="animate-in fade-in slide-in-from-bottom-4 duration-500">
           
           <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <div class="text-center mb-8">
                 <div class="h-12 w-12 bg-[#CCFF00]/10 text-[#CCFF00] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#CCFF00]/20">
                    <mat-icon>auto_awesome</mat-icon>
                 </div>
                 <h2 class="text-xl font-bold text-white mb-2">Diseña tu Semana</h2>
                 <p class="text-zinc-400 text-sm">Configura el generador IA para crear un bloque de entrenamiento perfecto.</p>
              </div>

              <!-- Step 1: Fitness Level -->
              <div class="mb-6">
                 <label class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Nivel de Fitness</label>
                 <div class="grid grid-cols-3 gap-2">
                    <button *ngFor="let level of levels" 
                            (click)="selectedLevel = level"
                            [class.bg-[#CCFF00]]="selectedLevel === level"
                            [class.text-black]="selectedLevel === level"
                            [class.border-[#CCFF00]]="selectedLevel === level"
                            class="py-3 px-1 rounded-xl border border-zinc-700 bg-zinc-800/50 text-zinc-400 text-xs font-bold uppercase tracking-wider hover:border-zinc-500 transition">
                       {{ level }}
                    </button>
                 </div>
              </div>

              <!-- Step 2: Goal -->
              <div class="mb-6">
                 <label class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Objetivo Principal</label>
                 <textarea [(ngModel)]="userGoal" 
                           class="w-full bg-[#0B0E14] border border-zinc-700 rounded-xl p-3 text-sm text-white focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition resize-none placeholder:text-zinc-600"
                           rows="2"
                           placeholder="Ej: Ganar fuerza en sentadilla, mejorar hombros..."></textarea>
              </div>

              <!-- Step 3: Days per Week -->
              <div class="mb-8">
                 <div class="flex justify-between items-center mb-3">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Días por Semana</label>
                    <span class="text-[#CCFF00] font-bold text-lg">{{ daysPerWeek }} Días</span>
                 </div>
                 <input type="range" min="2" max="6" step="1" [(ngModel)]="daysPerWeek" 
                        class="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#CCFF00]">
                 <div class="flex justify-between text-[10px] text-zinc-600 mt-2 font-mono">
                    <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                 </div>
              </div>

              <!-- AI Model -->
              <div class="mb-6">
                 <label class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Motor de Inteligencia</label>
                 <select 
                    [ngModel]="aiService.activeModel()" 
                    (ngModelChange)="aiService.activeModel.set($event)"
                    class="w-full bg-[#0B0E14] border border-zinc-700 rounded-xl p-3 text-sm text-white focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition outline-none appearance-none cursor-pointer">
                    <option value="gemini-2.5-flash">⚡ Entrenador Rápido (Flash)</option>
                    <option value="gemini-2.5-pro">🧠 Entrenador Élite (Pro)</option>
                 </select>
              </div>

              <!-- Action -->
              <button (click)="generatePlan()" 
                      [disabled]="!selectedLevel || !userGoal"
                      class="w-full py-4 bg-[#CCFF00] hover:bg-[#bbe600] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-extrabold text-sm uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_30px_rgba(204,255,0,0.5)] transition flex items-center justify-center gap-2">
                 <mat-icon>auto_awesome</mat-icon> Generar Plan Semanal
              </button>

           </div>

        </div>


        <!-- LIST STATE: GRID DE RUTINAS -->
        <div *ngIf="weekWorkouts().length > 0 && !isLoading()" class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
           
           <div *ngFor="let workout of weekWorkouts()" 
                (click)="goToWorkout(workout.id!)"
                class="group bg-[#151921] border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer hover:border-[#CCFF00] hover:translate-y-[-2px] transition-all duration-300 shadow-lg relative">
              
              <!-- Completion Status Strip (Left) -->
              <div class="absolute left-0 top-0 bottom-0 w-1 bg-zinc-700 group-hover:bg-[#CCFF00] transition-colors"></div>

              <div class="p-5 pl-7">
                 <div class="flex justify-between items-start mb-3">
                    <span class="inline-block px-2 py-1 rounded bg-[#CCFF00]/10 text-[#CCFF00] text-[10px] font-bold uppercase tracking-widest border border-[#CCFF00]/20">
                       {{ workout.fecha | date:'EEEE' : '' : 'es-CO' }}
                    </span>
                    <button (click)="deleteWorkout($event, workout.id!)" class="text-zinc-600 hover:text-red-500 transition">
                       <mat-icon class="text-lg">delete</mat-icon>
                    </button>
                 </div>

                 <h3 class="text-xl font-bold text-white mb-1 group-hover:text-[#CCFF00] transition-colors">{{ workout.nombre }}</h3>
                 
                 <div class="flex items-center gap-4 text-xs text-zinc-400 mt-2">
                    <span class="flex items-center gap-1"><mat-icon class="text-sm">fitness_center</mat-icon> {{ workout.ejercicios.length }} Ejercicios</span>
                    <span class="flex items-center gap-1"><mat-icon class="text-sm">signal_cellular_alt</mat-icon> {{ workout.nivelDificultad | titlecase }}</span>
                 </div>

                 <!-- Muscle Tags -->
                 <div class="flex flex-wrap gap-2 mt-4">
                    <span *ngFor="let m of (workout.musculos || []).slice(0, 3)" class="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                       {{ m }}
                    </span>
                    <span *ngIf="(workout.musculos?.length || 0) > 3" class="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">+{{ (workout.musculos?.length || 0) - 3 }}</span>
                 </div>
              </div>
              
              <!-- Right Chevron -->
              <div class="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[#CCFF00]">
                 <mat-icon>chevron_right</mat-icon>
              </div>

           </div>

        </div>

        <!-- Add Day with AI Button -->
        <div *ngIf="weekWorkouts().length > 0 && !isLoading()" class="mt-6 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <button (click)="addDayWithAI()" [disabled]="isGeneratingDay()"
                  class="group relative overflow-hidden py-3 px-6 rounded-full bg-zinc-800/80 border border-zinc-700 hover:border-[#CCFF00] hover:bg-zinc-800 transition-all duration-300 flex items-center justify-center gap-2 text-[#CCFF00] font-bold text-sm tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#CCFF00] focus:ring-offset-2 focus:ring-offset-[#151921] shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              
              <div class="absolute inset-0 bg-gradient-to-r from-[#CCFF00]/0 via-[#CCFF00]/10 to-[#CCFF00]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

              <mat-icon *ngIf="!isGeneratingDay()" class="text-lg">auto_awesome</mat-icon>
              <span *ngIf="!isGeneratingDay()">Autocompletar Día (IA)</span>
              <div *ngIf="isGeneratingDay()" class="h-4 w-4 border-2 border-zinc-500 border-t-[#CCFF00] rounded-full animate-spin"></div>
              <span *ngIf="isGeneratingDay()">Generando...</span>
          </button>
        </div>

      </div>

      <!-- Delete/Reset Confirmation Modal -->
      <div *ngIf="showConfirmModal()" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
         <div class="bg-[#151921] border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div class="flex items-center gap-3 text-red-500 mb-4">
               <div class="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <mat-icon>warning</mat-icon>
               </div>
               <h3 class="text-lg font-bold text-white tracking-wide">
                  {{ pendingAction() === 'reset' ? 'Borrar Plan Semanal' : 'Eliminar Rutina' }}
               </h3>
            </div>
            
            <p class="text-sm text-zinc-400 mb-8">
               ¿Estás seguro que deseas continuar? Esta acción no se puede deshacer y los datos se perderán permanentemente.
            </p>

            <div class="flex gap-3 justify-end mt-4">
               <button (click)="cancelAction()" class="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-bold tracking-wider text-xs hover:bg-zinc-800 transition">
                  CANCELAR
               </button>
               <button (click)="confirmAction()" class="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-500 border border-red-500/30 font-bold tracking-wider text-xs hover:bg-red-500 hover:text-white transition shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                  CONFIRMAR
               </button>
            </div>
         </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class WeeklyPlanComponent {
  // Services
  private workoutService = inject(WorkoutService);
  public aiService = inject(AiCoachService);
  private recoveryService = inject(RecoveryService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  // Constants
  levels: Array<'Principiante' | 'Intermedio' | 'Avanzado'> = ['Principiante', 'Intermedio', 'Avanzado'];

  // State
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  
  // Wizard State
  selectedLevel: 'Principiante' | 'Intermedio' | 'Avanzado' | null = null;
  userGoal: string = '';
  daysPerWeek: number = 3;

  // Workouts Signal (Filtered for "Weekly" Plan - in this MVP essentially just all future workouts, or current data)
  // For simplicity, we are showing ALL workouts sorted by date descending like a plan, but realistically we would filter by date range.
  // Let's filter to show only workouts from TODAY onwards + recently added.
  weekWorkouts = computed(() => {
     // Sort by date ascending (Plan logic)
     return [...this.workoutService.workouts()].sort((a,b) => 
        new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime()
     );
  });

  // Modal State
  showConfirmModal = signal<boolean>(false);
  pendingAction = signal<'delete' | 'reset' | null>(null);
  pendingWorkoutId = signal<number | null>(null);

  // AI State
  isGeneratingDay = signal<boolean>(false);

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  goToWorkout(id: number) {
     this.router.navigate(['/workouts', id]);
  }

  deleteWorkout(event: Event, id: number) {
     event.stopPropagation();
     this.pendingAction.set('delete');
     this.pendingWorkoutId.set(id);
     this.showConfirmModal.set(true);
  }

  resetPlan() {
     this.pendingAction.set('reset');
     this.showConfirmModal.set(true);
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

  async addDayWithAI() {
      if (this.isGeneratingDay()) return;
      
      this.isGeneratingDay.set(true);
      
      // Get Real Fatigue
      const fatigueRecord: Record<string, number> = {};
      this.recoveryService.muscleRecoveryStatus().forEach((val, key) => {
          fatigueRecord[key] = val.percentage;
      });

      const profile: UserProfile = {
         weight: 75, // Default for now
         height: 180,
         fatigueLevels: fatigueRecord,
         availableDays: ['Cualquiera'], 
         equipment: ['Gym Completo'],
         fitnessLevel: 'Intermedio',
         goal: 'hipertrofia'
      };

      const prompt = "Genera un solo día de entrenamiento para complementar mi rutina actual. Analiza mi fatiga para no sobrecargar músculos exhaustos. Que sea variado e interesante.";

      try {
           const newWorkout = await this.aiService.generateWorkout(prompt, profile);

           // Re-ajustar la fecha basándose en la fecha del último entrenamiento del plan actual, si existe.
           const currentWorkouts = this.weekWorkouts();
           if (currentWorkouts.length > 0) {
              const lastWorkout = currentWorkouts[currentWorkouts.length - 1];
              if (lastWorkout && lastWorkout.fecha) {
                 const newDate = new Date(lastWorkout.fecha);
                 newDate.setDate(newDate.getDate() + 1);
                 newWorkout.fecha = newDate.toISOString();
              }
           }

           await this.workoutService.addWorkout(newWorkout);
           this.toastService.showSuccess('✨ Nuevo día generado y agregado al plan.');

      } catch (err) {
           console.error(err);
           this.toastService.showError('Error al contactar a la IA. Revisa tu conexión.');
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

     const request: WeeklyPlanRequest = {
        userPrompt: this.userGoal,
        daysToGenerate: this.daysPerWeek,
        profile: {
           weight: 75, // Mock for now
           height: 180,
           fatigueLevels: fatigueRecord,
           availableDays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'], // Assumption
           equipment: ['Gym Completo'],
           fitnessLevel: this.selectedLevel,
           goal: 'hipertrofia' // Default
        }
     };

     try {
        const plans = await this.aiService.generateWeeklyPlan(request);
        
        for (const plan of plans) {
           await this.workoutService.addWorkout(plan);
        }
        this.toastService.showSuccess('Plan semanal generado satisfactoriamente.');
     } catch (err) {
        console.error(err);
        this.errorMessage.set('Error generando el plan. Intenta nuevamente.');
        this.toastService.showError('Ocurrió un error generando el plan.');
     } finally {
        this.isLoading.set(false);
     }
  }
}
