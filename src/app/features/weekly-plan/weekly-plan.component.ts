import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { WorkoutService } from '../../core/services/workout.service';
import { AiCoachService, WeeklyPlanRequest, UserProfile } from '../../core/services/ai-coach.service';
import { RecoveryService } from '../../core/services/recovery.service';

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
            <h1 class="text-2xl font-bold tracking-wider uppercase">Tu Plan Semanal</h1>
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
  private aiService = inject(AiCoachService);
  private recoveryService = inject(RecoveryService);
  private router = inject(Router);

  // Constants
  levels: Array<'Principiante' | 'Intermedio' | 'Avanzado'> = ['Principiante', 'Intermedio', 'Avanzado'];

  // State
  isLoading = signal<boolean>(false);
  
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

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  goToWorkout(id: number) {
     this.router.navigate(['/workouts', id]);
  }

  async deleteWorkout(event: Event, id: number) {
     event.stopPropagation();
     if(confirm('¿Estás seguro de eliminar esta rutina del plan?')) {
        await this.workoutService.deleteWorkout(id);
     }
  }

  async resetPlan() {
     if(confirm('¿Borrar TODO el plan actual? Esta acción no se puede deshacer.')) {
        // Delete all shown workouts
        for(const w of this.weekWorkouts()) {
           if(w.id) await this.workoutService.deleteWorkout(w.id);
        }
     }
  }

  async generatePlan() {
     if (!this.selectedLevel || !this.userGoal) return;

     this.isLoading.set(true);

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
        
        // Add all workouts to service
        for (const plan of plans) {
           await this.workoutService.addWorkout(plan);
        }
     } catch (err) {
        console.error(err);
        alert('Error generando el plan. Intenta nuevamente.');
     } finally {
        this.isLoading.set(false);
     }
  }
}
