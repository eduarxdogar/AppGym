import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-muscle-fatigue-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full max-w-sm mx-auto h-[400px] bg-black/20 rounded-xl p-4 border border-zinc-800 flex items-center justify-center">
      
      <!-- Título superpuesto -->
      <div class="absolute top-4 left-4">
        <h3 class="text-zinc-400 text-xs font-bold uppercase tracking-widest">Estado Muscular</h3>
        <p class="text-[10px] text-zinc-500">Recuperación estimada</p>
      </div>

      <!-- Human Body SVG Representation (Simplified Abstract/Tech Style) -->
      <svg viewBox="0 0 200 400" class="h-full w-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
        
        <!-- Silhouette Outline/Glow -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- Torso / Core -->
        <path d="M70,80 Q100,70 130,80 L140,180 Q100,200 60,180 Z" 
              [attr.fill]="getColor('core')" 
              class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />

        <!-- Pecho (Chest) -->
        <path d="M70,80 Q100,95 130,80 L125,120 Q100,130 75,120 Z" 
              [attr.fill]="getColor('pecho')" 
              class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />
              
        <!-- Hombros (Shoulders) -->
        <circle cx="60" cy="85" r="15" 
                [attr.fill]="getColor('hombros')" 
                class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />
        <circle cx="140" cy="85" r="15" 
                [attr.fill]="getColor('hombros')" 
                class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />

        <!-- Brazos (Arms - Biceps/Triceps combined for simplicity or separated) -->
        <rect x="45" y="105" width="20" height="50" rx="10"
              [attr.fill]="getColor('brazos')" 
              class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />
        <rect x="135" y="105" width="20" height="50" rx="10"
              [attr.fill]="getColor('brazos')" 
              class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />

        <!-- Piernas (Legs - Quads) -->
        <path d="M60,180 L95,185 L90,280 L65,280 Z" 
              [attr.fill]="getColor('piernas')" 
              class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />
        <path d="M140,180 L105,185 L110,280 L135,280 Z" 
              [attr.fill]="getColor('piernas')" 
              class="transition-colors duration-500 hover:opacity-80 stroke-zinc-900 stroke-2" />

        <!-- Espalda (Back - Abstracted as background or separate generic shape for visual balance) -->
        <!-- For this generic front view, back is usually not visible or combined. keeping it simple. -->

        <!-- Head (Generic) -->
        <circle cx="100" cy="50" r="18" fill="#333" class="stroke-zinc-700 stroke-1" />

      </svg>

      <!-- Legend -->
      <div class="absolute bottom-4 right-4 flex flex-col gap-2 text-[10px] text-zinc-500">
        <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span> Fresco</div>
        <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-500"></span> Fatiga Media</div>
        <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> Agotado</div>
      </div>
    </div>
  `,
  styles: []
})
export class MuscleFatigueMapComponent {
  // Input: Objeto con { 'grupoMuscular': porcentajeFatiga }
  // Ej: { 'pecho': 90, 'piernas': 10 }
  fatigueLevels = input<Record<string, number>>({});

  // Helper to get color based on fatigue level
  getColor(muscleGroup: string): string {
    const fatigue = this.fatigueLevels()[muscleGroup] || 0;
    
    // Map 'brazos' to biceps/triceps if generic
    // Map specific names users might use to visual zones
    
    if (fatigue < 30) return '#22c55e'; // Green-500
    if (fatigue < 70) return '#eab308'; // Yellow-500
    return '#ef4444'; // Red-500
  }
}
