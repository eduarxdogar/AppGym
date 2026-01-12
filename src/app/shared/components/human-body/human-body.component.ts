import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MuscleStatus } from '../../../core/services/recovery.service';

@Component({
  selector: 'app-human-body',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full max-w-[300px] mx-auto opacity-90 hover:opacity-100 transition-opacity">
       <svg viewBox="0 0 600 800" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto drop-shadow-xl">
        <!-- Definición de gradientes o filtros si fuera necesario -->
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Silueta Base (Frontal) -->
        <g transform="translate(0, 50)">
            <!-- Cabeza -->
            <circle cx="150" cy="50" r="30" class="fill-zinc-800" />
            <!-- Cuerpo Base -->
            <path d="M 120 80 L 180 80 L 190 250 L 110 250 Z" class="fill-zinc-800" />
            <path d="M 110 250 L 130 500 L 170 500 L 190 250 Z" class="fill-zinc-800" />
            <path d="M 120 80 L 80 250 L 110 250 Z" class="fill-zinc-800" /> <!-- Brazo I -->
            <path d="M 180 80 L 220 250 L 190 250 Z" class="fill-zinc-800" /> <!-- Brazo D -->
            
            <!-- Músculos Frontales -->
            <path id="pecs" 
                  d="M 120 100 Q 150 130 180 100 Q 170 160 130 160 Q 130 160 120 100" 
                  [ngClass]="getColor('Pecho')"
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110 cursor-pointer" />

            <path id="delts-front-l" 
                  d="M 100 85 Q 120 75 135 90 L 130 120 Q 110 120 100 110 Z"
                  [ngClass]="getColor('Hombros')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />
            <path id="delts-front-r" 
                  d="M 200 85 Q 180 75 165 90 L 170 120 Q 190 120 200 110 Z"
                  [ngClass]="getColor('Hombros')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />

            <rect id="abs" x="135" y="165" width="30" height="70" rx="5"
                  [ngClass]="getColor('Core')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />

            <path id="quads-l" 
                  d="M 130 250 Q 110 350 125 420 L 145 420 Q 155 350 150 250 Z"
                  [ngClass]="getColor('Cuádriceps')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />
             <path id="quads-r" 
                  d="M 170 250 Q 190 350 175 420 L 155 420 Q 145 350 150 250 Z"
                  [ngClass]="getColor('Cuádriceps')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />
        </g>
        
        <!-- Silueta Base (Trasera) - Desplazada a la derecha -->
        <g transform="translate(300, 50)">
             <!-- Cabeza -->
            <circle cx="150" cy="50" r="30" class="fill-zinc-800" />
             <!-- Cuerpo Base -->
            <path d="M 120 80 L 180 80 L 190 250 L 110 250 Z" class="fill-zinc-800" />
            <path d="M 110 250 L 130 500 L 170 500 L 190 250 Z" class="fill-zinc-800" />
             <path d="M 120 80 L 80 250 L 110 250 Z" class="fill-zinc-800" /> 
            <path d="M 180 80 L 220 250 L 190 250 Z" class="fill-zinc-800" />

            <!-- Músculos Traseros -->
            <path id="back" 
                  d="M 130 90 L 170 90 L 160 180 L 140 180 Z"
                  [ngClass]="getColor('Espalda')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />

            <path id="glutes" 
                  d="M 130 250 Q 150 270 170 250 Q 170 290 150 290 Q 130 290 130 250"
                  [ngClass]="getColor('Glúteos')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />

            <path id="hamstrings-l" 
                  d="M 130 300 L 145 420 L 135 420 L 125 300 Z"
                  [ngClass]="getColor('Isquios')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />
             <path id="hamstrings-r" 
                  d="M 170 300 L 155 420 L 165 420 L 175 300 Z"
                  [ngClass]="getColor('Isquios')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />
                  
            <!-- Triceps -->
             <path id="triceps-l" 
                  d="M 115 100 L 100 180 L 110 180 L 125 100 Z"
                  [ngClass]="getColor('Tríceps')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />
               <path id="triceps-r" 
                  d="M 185 100 L 200 180 L 190 180 L 175 100 Z"
                  [ngClass]="getColor('Tríceps')" 
                  class="transition-all duration-500 stroke-zinc-900 stroke-1 hover:brightness-110" />
        </g>
      </svg>
    </div>
  `
})
export class HumanBodyComponent {
  // Recibimos el mapa completo de estados (nombre -> MuscleStatus)
  // Se adapta para aceptar Map<string, MuscleStatus> que es lo que tiene el servicio
  recoveryStatus = input.required<Map<string, MuscleStatus>>();

  getColor(muscleName: string): string {
    const statusIdx = this.recoveryStatus();
    
    // Búsqueda flexible (case insensitive y parcial)
    const normalizedTarget = muscleName.toLowerCase();
    
    // Buscar en las claves del mapa
    const key = Array.from(statusIdx.keys()).find(k => k.toLowerCase().includes(normalizedTarget));
    
    if (!key) return 'fill-zinc-700'; // Default: No entrenado / Sin datos

    const status = statusIdx.get(key);
    if (!status) return 'fill-zinc-700';

    const percent = status.percentage;

    if (percent <= 40) return 'fill-red-500';
    if (percent <= 80) return 'fill-yellow-500';
    return 'fill-green-500';
  }
}
