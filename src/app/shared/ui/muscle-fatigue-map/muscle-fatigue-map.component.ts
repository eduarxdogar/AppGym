import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-muscle-fatigue-map',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  template: `
    <div class="relative w-full max-w-sm mx-auto aspect-[1/2] bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 flex items-center justify-center overflow-hidden">
      
      <!-- Título superpuesto -->
      <div class="absolute top-4 left-4 z-10">
        <h3 class="text-zinc-400 text-xs font-bold uppercase tracking-widest">Estado Muscular</h3>
        <p class="text-[10px] text-zinc-500">Recuperación estimada</p>
      </div>

      <!-- Human Body SVG Representation -->
      <svg viewBox="0 0 200 400" class="h-full w-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]">
        
        <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        <!-- Head (Generic) -->
        <circle cx="100" cy="40" r="15" fill="#3f3f46" class="stroke-zinc-800 stroke-1" />

        <!-- Hombros (Shoulders) -->
        <path d="M70,55 Q100,65 130,55 L145,75 Q135,85 130,90 L70,90 Q65,85 55,75 Z" 
              [attr.fill]="getColor('hombros')" 
              [matTooltip]="getTooltip('hombros')"
              class="transition-all duration-500 hover:opacity-80 cursor-help stroke-zinc-900 stroke-1" />

        <!-- Pecho (Chest) -->
        <path d="M70,90 L130,90 L125,130 Q100,140 75,130 Z" 
              [attr.fill]="getColor('pecho')" 
              [matTooltip]="getTooltip('pecho')"
              class="transition-all duration-500 hover:opacity-80 cursor-help stroke-zinc-900 stroke-1" />

        <!-- Core / Abs -->
        <path d="M75,130 Q100,140 125,130 L130,190 Q100,200 70,190 Z" 
              [attr.fill]="getColor('core')" 
              [matTooltip]="getTooltip('core')"
              class="transition-all duration-500 hover:opacity-80 cursor-help stroke-zinc-900 stroke-1" />

        <!-- Brazos (Biceps/Triceps combined) -->
        <!-- Izquierdo -->
        <path d="M55,75 L40,150 L60,150 L70,90 Z" 
              [attr.fill]="getColor('brazos')" 
              [matTooltip]="getTooltip('brazos')"
              class="transition-all duration-500 hover:opacity-80 cursor-help stroke-zinc-900 stroke-1" />
        <!-- Derecho -->
        <path d="M145,75 L160,150 L140,150 L130,90 Z" 
              [attr.fill]="getColor('brazos')" 
              [matTooltip]="getTooltip('brazos')"
              class="transition-all duration-500 hover:opacity-80 cursor-help stroke-zinc-900 stroke-1" />

        <!-- Piernas (Quads) -->
        <path d="M70,190 L95,195 L90,320 L65,320 L55,200 Z" 
              [attr.fill]="getColor('piernas')" 
              [matTooltip]="getTooltip('piernas')"
              class="transition-all duration-500 hover:opacity-80 cursor-help stroke-zinc-900 stroke-1" />
        
        <path d="M130,190 L105,195 L110,320 L135,320 L145,200 Z" 
              [attr.fill]="getColor('piernas')" 
              [matTooltip]="getTooltip('piernas')"
              class="transition-all duration-500 hover:opacity-80 cursor-help stroke-zinc-900 stroke-1" />

      </svg>
      
      <!-- Legend -->
      <div class="absolute bottom-4 right-4 flex flex-col gap-1.5 pointer-events-none">
        <div class="flex items-center gap-2 text-[10px] text-zinc-500">
            <span class="w-1.5 h-1.5 rounded-full bg-zinc-700"></span> Fresco
        </div>
        <div class="flex items-center gap-2 text-[10px] text-zinc-400">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]"></span> Trabajado
        </div>
        <div class="flex items-center gap-2 text-[10px] text-zinc-300">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span> Fatigado
        </div>
      </div>

    </div>
  `,
  styles: []
})
export class MuscleFatigueMapComponent {
  // Input: Objeto con { 'grupoMuscular': porcentajeFatiga }
  muscleFatigue = input<Record<string, number>>({});

  // Color Mapping
  getColor(muscleGroup: string): string {
    const fatigue = this.muscleFatigue()[muscleGroup] || 0;
    
    // Default (Descansado) -> Zinc-800/700
    if (fatigue < 10) return '#3f3f46'; 
    
    // Trabajado (30% - 70%) -> Yellow
    if (fatigue < 70) return '#eab308'; 
    
    // Fatigado (>70%) -> Red/Neon
    return '#ef4444'; 
  }

  getTooltip(muscleGroup: string): string {
     const fatigue = this.muscleFatigue()[muscleGroup] || 0;
     const nameMap: Record<string, string> = {
         'pecho': 'Pecho',
         'espalda': 'Espalda',
         'hombros': 'Hombros',
         'brazos': 'Brazos',
         'piernas': 'Piernas',
         'core': 'Core / Abs'
     };
     const name = nameMap[muscleGroup] || muscleGroup;
     return `${name}: ${fatigue}% Fatiga`;
  }
}
