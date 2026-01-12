import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MuscleStatus } from '../../../core/services/recovery.service';

@Component({
  selector: 'app-professional-body-map',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .neon-red { 
      fill: #ef4444; 
      filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.9)); 
      stroke: #fca5a5;
      stroke-width: 1px;
      transition: all 0.5s ease;
    }
    .neon-yellow { 
      fill: #eab308; 
      filter: drop-shadow(0 0 6px rgba(234, 179, 8, 0.7)); 
      stroke: #fde047;
      stroke-width: 1px;
      transition: all 0.5s ease;
    }
    .neon-green { 
      fill: #10b981; 
      filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.5)); 
      stroke: #6ee7b7;
      stroke-width: 1px;
      transition: all 0.5s ease;
    }
    .base-dark { 
      fill: #18181b; 
      stroke: #27272a; 
      stroke-width: 1px; 
      transition: all 0.3s ease;
    }
    .base-dark:hover { 
      fill: #27272a; 
      stroke: #3f3f46;
    }
    .grid-bg {
      background-image: linear-gradient(rgba(34, 197, 94, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(34, 197, 94, 0.05) 1px, transparent 1px);
      background-size: 20px 20px;
    }
  `],
  template: `
    <div class="relative w-full max-w-4xl mx-auto p-4 rounded-xl border border-zinc-800/50 bg-zinc-950/50 grid-bg overflow-hidden">
      
      <!-- Scan Line Animation -->
      <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div class="w-full h-[2px] bg-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-[scan_4s_linear_infinite]"></div>
      </div>

      <div class="relative z-10 flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
        
        <!-- VISTA ANTERIOR (FRENTE) -->
        <div class="w-full max-w-[280px]">
          <div class="text-center mb-2">
            <span class="text-[10px] tracking-[0.4em] text-green-500/50 uppercase font-mono">Anterior Scan</span>
          </div>
          
          <svg viewBox="0 0 300 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
            <!-- Cabeza Hexagonal -->
            <path d="M 130 40 L 170 40 L 180 80 L 150 100 L 120 80 Z" class="base-dark" />
            <!-- Cuello -->
            <path d="M 135 85 L 165 85 L 175 110 L 125 110 Z" class="base-dark" />

            <!-- TRAPECIO -->
            <path d="M 125 110 L 175 110 L 190 125 L 110 125 Z" class="base-dark" />

            <!-- HOMBROS (Poligonales) -->
            <path id="shoulders-left" d="M 110 125 L 130 130 L 130 155 L 90 160 L 95 135 Z" 
                  [ngClass]="getColor('Hombros')" />
            <path id="shoulders-right" d="M 190 125 L 170 130 L 170 155 L 210 160 L 205 135 Z" 
                  [ngClass]="getColor('Hombros')" />

            <!-- PECHO (Placas Tech) -->
            <path id="chest-left" d="M 150 130 L 130 130 L 130 170 L 150 180 Z" 
                  [ngClass]="getColor('Pecho')" />
            <path id="chest-right" d="M 150 130 L 170 130 L 170 170 L 150 180 Z" 
                  [ngClass]="getColor('Pecho')" />

            <!-- BICEPS -->
            <path id="biceps-left" d="M 90 160 L 130 155 L 125 190 L 95 195 Z" 
                  [ngClass]="getColor('Bíceps')" />
            <path id="biceps-right" d="M 210 160 L 170 155 L 175 190 L 205 195 Z" 
                  [ngClass]="getColor('Bíceps')" />

            <!-- ANTEBRAZOS -->
            <path id="forearms-left" d="M 95 195 L 125 190 L 115 240 L 90 240 Z" 
                  [ngClass]="getColor('Antebrazos')" />
            <path id="forearms-right" d="M 205 195 L 175 190 L 185 240 L 210 240 Z" 
                  [ngClass]="getColor('Antebrazos')" />

            <!-- CORE (Abs Segmentados) -->
            <path id="abs-upper" d="M 135 180 L 165 180 L 162 200 L 138 200 Z" [ngClass]="getColor('Core')" />
            <path id="abs-mid" d="M 138 205 L 162 205 L 160 225 L 140 225 Z" [ngClass]="getColor('Core')" />
            <path id="abs-lower" d="M 140 230 L 160 230 L 158 250 L 142 250 Z" [ngClass]="getColor('Core')" />
            
            <!-- OBLICUOS -->
            <path id="obliques-left" d="M 135 180 L 138 200 L 140 225 L 130 245 L 115 190 Z" [ngClass]="getColor('Core')" />
            <path id="obliques-right" d="M 165 180 L 162 200 L 160 225 L 170 245 L 185 190 Z" [ngClass]="getColor('Core')" />

            <!-- CUADRICEPS (Blindaje) -->
            <path id="quads-left" d="M 130 250 L 150 250 L 145 340 L 125 340 L 110 280 Z" 
                  [ngClass]="getColor('Cuádriceps')" />
            <path id="quads-right" d="M 170 250 L 150 250 L 155 340 L 175 340 L 190 280 Z" 
                  [ngClass]="getColor('Cuádriceps')" />

            <!-- GEMELOS (Frontal) -->
            <path id="calves-left" d="M 125 345 L 145 345 L 140 420 L 130 420 Z" 
                  [ngClass]="getColor('Gemelos')" />
            <path id="calves-right" d="M 175 345 L 155 345 L 160 420 L 170 420 Z" 
                  [ngClass]="getColor('Gemelos')" />
          </svg>
        </div>

        <!-- VISTA POSTERIOR (ESPALDA) -->
        <div class="w-full max-w-[280px]">
          <div class="text-center mb-2">
            <span class="text-[10px] tracking-[0.4em] text-green-500/50 uppercase font-mono">Posterior Scan</span>
          </div>
          
          <svg viewBox="0 0 300 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
             <!-- Cabeza -->
            <path d="M 130 40 L 170 40 L 180 80 L 120 80 Z" class="base-dark" />

            <!-- TRAPECIO (Upper Armor) -->
            <path id="traps" d="M 135 85 L 165 85 L 190 115 L 150 125 L 110 115 Z" 
                  [ngClass]="getColor('Trapecio')" />

            <!-- HOMBROS (Posterior) -->
            <path id="shoulders-back-left" d="M 110 115 L 130 120 L 125 150 L 90 145 Z" 
                  [ngClass]="getColor('Hombros')" />
            <path id="shoulders-back-right" d="M 190 115 L 170 120 L 175 150 L 210 145 Z" 
                  [ngClass]="getColor('Hombros')" />

            <!-- DORSALES (Alas Tech) -->
            <path id="lats-left" d="M 130 130 L 150 125 L 150 210 L 135 200 L 115 160 Z" 
                  [ngClass]="getColor('Espalda')" />
            <path id="lats-right" d="M 170 130 L 150 125 L 150 210 L 165 200 L 185 160 Z" 
                  [ngClass]="getColor('Espalda')" />

            <!-- TRICEPS -->
            <path id="triceps-left" d="M 90 145 L 125 150 L 115 190 L 95 185 Z" 
                  [ngClass]="getColor('Tríceps')" />
            <path id="triceps-right" d="M 210 145 L 175 150 L 185 190 L 205 185 Z" 
                  [ngClass]="getColor('Tríceps')" />

            <!-- LUMBARES (Placa Baja) -->
            <path id="lower-back" d="M 135 200 L 165 200 L 160 230 L 140 230 Z" 
                  [ngClass]="getColor('Lumbares')" />

            <!-- GLUTEOS (Blindaje Posterior) -->
            <path id="glutes-left" d="M 140 230 L 150 230 L 150 280 L 120 270 L 130 240 Z" 
                  [ngClass]="getColor('Glúteos')" />
            <path id="glutes-right" d="M 160 230 L 150 230 L 150 280 L 180 270 L 170 240 Z" 
                  [ngClass]="getColor('Glúteos')" />

            <!-- ISQUIOS -->
            <path id="hamstrings-left" d="M 120 270 L 150 280 L 145 350 L 115 340 Z" 
                  [ngClass]="getColor('Isquiotibiales')" />
            <path id="hamstrings-right" d="M 180 270 L 150 280 L 155 350 L 185 340 Z" 
                  [ngClass]="getColor('Isquiotibiales')" />

            <!-- GEMELOS (Posterior) -->
            <path id="calves-back-left" d="M 115 340 L 145 350 L 140 420 L 125 420 Z" 
                  [ngClass]="getColor('Gemelos')" />
            <path id="calves-back-right" d="M 185 340 L 155 350 L 160 420 L 175 420 Z" 
                  [ngClass]="getColor('Gemelos')" />
          </svg>
        </div>
      </div>
    </div>
  `
})
export class ProfessionalBodyMapComponent {
  recoveryStatus = input.required<Map<string, MuscleStatus>>();

  private getStatusForMuscle(targetName: string): MuscleStatus | undefined {
    const statusMap = this.recoveryStatus();
    targetName = targetName.toLowerCase();
    
    // 1. Direct Hit
    const key = Array.from(statusMap.keys()).find(k => k.toLowerCase().includes(targetName));
    if (key) return statusMap.get(key);

    // 2. Fallbacks
    if (targetName === 'lumbares' || targetName === 'trapecio' || targetName === 'dorsales') {
      const backKey = Array.from(statusMap.keys()).find(k => k.toLowerCase().includes('espalda'));
      if (backKey) return statusMap.get(backKey);
    }

    return undefined;
  }

  getColor(muscleName: string): string {
    const status = this.getStatusForMuscle(muscleName);
    
    if (!status) return 'base-dark'; // Clase default

    const percentage = status.percentage;

    if (percentage <= 40) return 'neon-red';
    if (percentage <= 80) return 'neon-yellow';
    return 'neon-green';
  }
}
