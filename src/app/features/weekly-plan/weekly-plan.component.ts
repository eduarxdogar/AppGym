import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface WeeklyRoutine {
  id: number;
  tag: string;
  title: string;
  meta: string;
  thumbnails: string[];
}

@Component({
  selector: 'app-weekly-plan',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#0B0E14] p-4 pb-20 animate-fadeIn">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-8 pt-2 max-w-lg mx-auto">
        <button (click)="goBack()" class="h-10 w-10 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700 transition border border-zinc-700">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div>
           <h1 class="text-2xl font-bold text-white tracking-wider uppercase">Tu Plan Semanal</h1>
           <p class="text-xs text-zinc-500 tracking-widest">AGENDA DE ENTRENAMIENTO</p>
        </div>
      </div>

      <!-- Cards List -->
      <div class="space-y-4 max-w-lg mx-auto">
        <div *ngFor="let workout of weeklyWorkouts" 
             class="group bg-[#151921] border border-zinc-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-[#CCFF00] hover:bg-[#1a1f29] transition-all duration-300 shadow-md">
           
           <!-- Left Content -->
           <div class="flex-1 mr-4">
              <!-- Badge -->
              <span class="inline-block bg-[#CCFF00] text-black text-[10px] font-bold px-2 py-0.5 rounded mb-2 uppercase tracking-wide">
                {{ workout.tag }}
              </span>
              
              <!-- Title & Meta -->
              <h4 class="text-white font-bold text-lg leading-tight mb-1 group-hover:text-[#CCFF00] transition-colors">
                {{ workout.title }}
              </h4>
              <p class="text-slate-400 text-xs font-medium">
                {{ workout.meta }}
              </p>

              <!-- Thumbnails (Row) -->
              <div class="flex items-center gap-2 mt-3">
                 <img *ngFor="let thumb of workout.thumbnails" 
                      [src]="thumb" 
                      alt="Ejercicio" 
                      class="w-8 h-8 rounded-md object-cover border border-zinc-700 bg-zinc-800" />
                 
                 <!-- More exercises indicator -->
                 <div class="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400">
                    +3
                 </div>
              </div>
           </div>

           <!-- Right Arrow -->
           <div class="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-[#CCFF00] group-hover:text-black transition-colors">
              <mat-icon>chevron_right</mat-icon>
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
  private router = inject(Router);

  weeklyWorkouts: WeeklyRoutine[] = [
    {
      id: 1,
      tag: 'Esta semana - Empuje',
      title: 'Pectorales, Hombros y Tríceps',
      meta: '96 min • 10 ejercicios',
      thumbnails: [
        'https://placehold.co/100x100/222/lime?text=P', 
        'https://placehold.co/100x100/222/lime?text=H',
        'https://placehold.co/100x100/222/lime?text=T'
      ]
    },
    {
      id: 2,
      tag: 'Esta semana - Jalón',
      title: 'Espalda, Bíceps y Trapecio',
      meta: '85 min • 8 ejercicios',
      thumbnails: [
        'https://placehold.co/100x100/222/333?text=E', 
        'https://placehold.co/100x100/222/333?text=B',
        'https://placehold.co/100x100/222/333?text=T'
      ]
    },
    {
      id: 3,
      tag: 'Esta semana - Pierna',
      title: 'Cuádriceps, Isquios y Gemelos',
      meta: '105 min • 7 ejercicios',
      thumbnails: [
        'https://placehold.co/100x100/222/orange?text=C', 
        'https://placehold.co/100x100/222/orange?text=I',
        'https://placehold.co/100x100/222/orange?text=G'
      ]
    }
  ];

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
