import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MetricsService } from '../../../core/services/metrics.service';
import { ProgressionOptions } from '../../../core/services/progression-engine.service';

@Component({
  selector: 'app-weekly-summary-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div class="bg-[#151921] border border-zinc-700 rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500 min-h-[400px] flex flex-col justify-center">
        
        <!-- Ambient Glow -->
        <div class="absolute top-[-20%] left-[-20%] w-[200px] h-[200px] bg-[#CCFF00]/20 blur-[80px] pointer-events-none"></div>

        <!-- LOADING STATE (Spinner) -->
        <div *ngIf="isGenerating()" class="flex flex-col items-center justify-center space-y-6 relative z-10 py-10">
           <div class="relative h-20 w-20">
              <div class="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
              <div class="absolute inset-0 border-4 border-[#CCFF00] rounded-full border-t-transparent animate-spin"></div>
              <mat-icon class="absolute inset-0 m-auto text-[#CCFF00] h-6 w-6 text-2xl flex items-center justify-center animate-pulse">auto_awesome</mat-icon>
           </div>
           <p class="text-[#CCFF00] font-bold tracking-widest animate-pulse uppercase text-center text-lg">Planificando plan con IA...</p>
           <p class="text-zinc-500 text-xs text-center uppercase tracking-widest">Calculando sobrecarga progresiva<br>y ajustando cargas.</p>
        </div>

        <!-- STEP 1: SUMMARY -->
        <div *ngIf="step() === 1 && !isGenerating()" class="animate-in fade-in duration-300">
          <!-- Header -->
          <div class="text-center mb-8 relative z-10">
            <div class="inline-flex h-16 w-16 bg-[#CCFF00]/10 text-[#CCFF00] rounded-2xl items-center justify-center mb-4 border border-[#CCFF00]/30 shadow-[0_0_20px_rgba(204,255,0,0.2)]">
              <mat-icon class="text-4xl" style="height: 36px; width: 36px; font-size: 36px;">emoji_events</mat-icon>
            </div>
            <h2 class="text-2xl font-black text-white uppercase tracking-wider">¡Microciclo Completado!</h2>
            <p class="text-zinc-400 text-sm mt-2">Has dominado tu plan semanal. Este es tu impacto real:</p>
          </div>

          <!-- Metrics Grid -->
          <div class="grid grid-cols-2 gap-4 mb-8 relative z-10">
            <div class="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-center">
              <mat-icon class="text-blue-400 mb-1">event_available</mat-icon>
              <div class="text-2xl font-black text-white">{{ metrics().workoutsCount }}</div>
              <div class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Días Entrenados</div>
            </div>

            <div class="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-center">
              <mat-icon class="text-[#CCFF00] mb-1">fitness_center</mat-icon>
              <div class="text-2xl font-black text-white">
                {{ metrics().totalVolume >= 1000 ? (metrics().totalVolume / 1000 | number:'1.1-1') + 't' : (metrics().totalVolume | number:'1.0-0') + 'kg' }}
              </div>
              <div class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Tonelaje Total</div>
            </div>

            <div class="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-center col-span-2 flex items-center justify-center gap-6">
              <div>
                <mat-icon class="text-orange-400 mb-1">timer</mat-icon>
                <div class="text-2xl font-black text-white">~{{ metrics().workoutsCount * 60 }}</div>
                <div class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Minutos Bajo Tensión</div>
              </div>
              <div class="h-10 w-px bg-zinc-800"></div>
              <div>
                <mat-icon class="text-purple-400 mb-1">repeat</mat-icon>
                <div class="text-2xl font-black text-white">{{ metrics().totalSets }}</div>
                <div class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Series Efectivas</div>
              </div>
            </div>
          </div>

          <!-- CTA Button -->
          <button (click)="step.set(2)" 
                  class="w-full py-4 bg-[#CCFF00] hover:bg-[#bbe600] text-black font-extrabold text-sm uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_30px_rgba(204,255,0,0.5)] transition-all flex items-center justify-center gap-2 relative z-10 group">
            <mat-icon class="group-hover:rotate-12 transition-transform">tune</mat-icon> 
            Configurar Próxima Semana
          </button>
        </div>

        <!-- STEP 2: AUTOREGULATION -->
        <div *ngIf="step() === 2 && !isGenerating()" class="animate-in slide-in-from-right duration-300 relative z-10">
          <div class="text-center mb-6">
            <h2 class="text-xl font-black text-white uppercase tracking-wider flex items-center justify-center gap-2">
              <mat-icon class="text-[#CCFF00]">psychology</mat-icon> Autorregulación
            </h2>
            <p class="text-zinc-400 text-sm mt-2">Dile a tu AI Coach cómo enfocar el próximo microciclo.</p>
          </div>

          <!-- Focus Options -->
          <div class="mb-6">
            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Enfoque de Progresión</label>
            <div class="space-y-2">
              <div (click)="selectedFocus.set('weight')"
                   [ngClass]="selectedFocus() === 'weight' ? 'border-lime-400 bg-lime-400/10' : 'border-zinc-800 bg-zinc-900/50'"
                   class="p-4 rounded-xl border cursor-pointer hover:border-zinc-600 transition flex items-center gap-3">
                 <mat-icon [ngStyle]="{'color': selectedFocus() === 'weight' ? '#CCFF00' : '#71717a'}">fitness_center</mat-icon>
                 <div>
                    <h4 class="text-sm font-bold text-white">Priorizar Fuerza (+Peso)</h4>
                    <p class="text-xs text-zinc-500 mt-0.5">Incrementos agresivos de carga.</p>
                 </div>
              </div>
              <div (click)="selectedFocus.set('volume')"
                   [ngClass]="selectedFocus() === 'volume' ? 'border-lime-400 bg-lime-400/10' : 'border-zinc-800 bg-zinc-900/50'"
                   class="p-4 rounded-xl border cursor-pointer hover:border-zinc-600 transition flex items-center gap-3">
                 <mat-icon [ngStyle]="{'color': selectedFocus() === 'volume' ? '#CCFF00' : '#71717a'}">repeat</mat-icon>
                 <div>
                    <h4 class="text-sm font-bold text-white">Priorizar Hipertrofia (+Volumen)</h4>
                    <p class="text-xs text-zinc-500 mt-0.5">Más series y repeticiones.</p>
                 </div>
              </div>
            </div>
          </div>

          <!-- Frequency Options -->
          <div class="mb-8">
            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Frecuencia (Días)</label>
            <select [ngModel]="frequencyAdj()" (ngModelChange)="frequencyAdj.set($event)"
                    class="w-full bg-[#0B0E14] border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] outline-none cursor-pointer">
              <option [ngValue]="0">Mantener frecuencia actual</option>
              <option [ngValue]="1">Agregar un día más (+1)</option>
              <option [ngValue]="-1">Quitar un día de entrenamiento (-1)</option>
            </select>
          </div>

          <div class="flex gap-3">
            <button (click)="step.set(1)" class="px-4 py-4 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white transition flex items-center justify-center">
               <mat-icon>arrow_back</mat-icon>
            </button>
            <button (click)="submitRollover()" 
                    class="flex-1 py-4 bg-[#CCFF00] hover:bg-[#bbe600] text-black font-extrabold text-sm uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all flex items-center justify-center gap-2">
              <mat-icon>auto_awesome</mat-icon> Planificar con IA Coach
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class WeeklySummaryModalComponent {
  private metricsService = inject(MetricsService);
  metrics = this.metricsService.weeklyMetrics;

  @Output() onRollover = new EventEmitter<ProgressionOptions>();

  // State
  step = signal<1 | 2>(1);
  isGenerating = signal(false);
  
  // Form Models
  selectedFocus = signal<'weight' | 'volume'>('weight');
  frequencyAdj = signal<number>(0);

  submitRollover() {
    this.isGenerating.set(true);
    // Let the parent component handle the delay and saving logic
    this.onRollover.emit({
      focus: this.selectedFocus(),
      frequencyAdjustment: this.frequencyAdj()
    });
  }
}
