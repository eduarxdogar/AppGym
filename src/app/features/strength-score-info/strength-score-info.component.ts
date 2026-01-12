import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-strength-score-info',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#0B0E14] text-slate-200 p-6 pb-20 fade-in font-sans">
      
      <!-- Back Button -->
      <div class="max-w-2xl mx-auto mb-8">
        <button (click)="goBack()" class="h-10 w-10 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700 transition border border-zinc-700">
          <mat-icon>arrow_back</mat-icon>
        </button>
      </div>

      <!-- Article Content -->
      <article class="max-w-2xl mx-auto space-y-12">
        
        <!-- Header -->
        <header class="space-y-6 border-b border-zinc-800 pb-8">
           <h1 class="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
             Puntaje de Fuerza: <br>
             <span class="text-[#CCFF00]">¿Cómo funciona?</span>
           </h1>
           
           <div class="flex items-center gap-4">
              <div class="h-10 w-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                 <span class="font-bold text-xs text-zinc-500">CG</span>
              </div>
              <div>
                 <p class="text-sm font-bold text-white">Escrito por Cristian Garzon</p>
                 <p class="text-xs text-zinc-500">Actualizado recientemente</p>
              </div>
           </div>
        </header>

        <!-- Section 1 -->
        <section>
           <h2 class="text-2xl font-bold text-white mb-4">Cálculo del Puntaje</h2>
           <p class="text-lg text-zinc-300 leading-relaxed font-light">
              El <span class="text-[#CCFF00] font-medium">Puntaje de Fuerza</span> es un número único que refleja tu rendimiento relativo, influenciado por: Tu 
              <strong class="text-white">1RM (Máximo estimado en los últimos 3 meses)</strong>, Selección de ejercicios, Género, Edad y Peso Corporal.
           </p>
        </section>

        <!-- Section 2 -->
        <section>
           <h2 class="text-2xl font-bold text-white mb-6">Selección de Ejercicios</h2>
           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div class="bg-[#151921] border border-zinc-800 p-4 rounded-xl">
                 <h3 class="text-[#CCFF00] font-bold text-sm uppercase tracking-wider mb-2">Pectorales</h3>
                 <ul class="text-zinc-400 text-sm space-y-1">
                    <li class="flex items-center gap-2"><div class="h-1 w-1 bg-zinc-500 rounded-full"></div> Press Banca</li>
                    <li class="flex items-center gap-2"><div class="h-1 w-1 bg-zinc-500 rounded-full"></div> Press Inclinado</li>
                 </ul>
              </div>

               <div class="bg-[#151921] border border-zinc-800 p-4 rounded-xl">
                 <h3 class="text-[#CCFF00] font-bold text-sm uppercase tracking-wider mb-2">Espalda</h3>
                 <ul class="text-zinc-400 text-sm space-y-1">
                    <li class="flex items-center gap-2"><div class="h-1 w-1 bg-zinc-500 rounded-full"></div> Dominadas</li>
                    <li class="flex items-center gap-2"><div class="h-1 w-1 bg-zinc-500 rounded-full"></div> Remo con barra</li>
                 </ul>
              </div>

               <div class="bg-[#151921] border border-zinc-800 p-4 rounded-xl">
                 <h3 class="text-[#CCFF00] font-bold text-sm uppercase tracking-wider mb-2">Hombros</h3>
                 <ul class="text-zinc-400 text-sm space-y-1">
                    <li class="flex items-center gap-2"><div class="h-1 w-1 bg-zinc-500 rounded-full"></div> Press Militar</li>
                 </ul>
              </div>

               <div class="bg-[#151921] border border-zinc-800 p-4 rounded-xl">
                 <h3 class="text-[#CCFF00] font-bold text-sm uppercase tracking-wider mb-2">Piernas</h3>
                 <ul class="text-zinc-400 text-sm space-y-1">
                    <li class="flex items-center gap-2"><div class="h-1 w-1 bg-zinc-500 rounded-full"></div> Sentadilla</li>
                    <li class="flex items-center gap-2"><div class="h-1 w-1 bg-zinc-500 rounded-full"></div> Peso Muerto</li>
                 </ul>
              </div>

           </div>
        </section>

        <!-- Section 3 -->
        <section>
           <h2 class="text-2xl font-bold text-white mb-6">Niveles de Fuerza</h2>
           <div class="space-y-3">
              <div class="flex items-center gap-4 text-sm">
                 <div class="w-32 text-right text-zinc-400">Principiante</div>
                 <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div class="h-full w-[20%] bg-green-500"></div>
                 </div>
              </div>
              <div class="flex items-center gap-4 text-sm">
                 <div class="w-32 text-right text-zinc-400">Novato</div>
                 <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div class="h-full w-[40%] bg-yellow-400"></div>
                 </div>
              </div>
              <div class="flex items-center gap-4 text-sm">
                 <div class="w-32 text-right text-zinc-400">Experimentado</div>
                 <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div class="h-full w-[60%] bg-blue-500"></div>
                 </div>
              </div>
               <div class="flex items-center gap-4 text-sm">
                 <div class="w-32 text-right text-zinc-400">Elite</div>
                 <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div class="h-full w-[80%] bg-purple-500"></div>
                 </div>
              </div>
               <div class="flex items-center gap-4 text-sm">
                 <div class="w-32 text-right text-zinc-400">Olímpico</div>
                 <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div class="h-full w-[100%] bg-[#FFD700]"></div>
                 </div>
              </div>
           </div>
        </section>

        <!-- Section 4 -->
        <section class="bg-zinc-900/30 p-8 rounded-2xl border-l-4 border-[#CCFF00]">
           <h2 class="text-xl font-bold text-white mb-2">¿Por qué es importante?</h2>
           <p class="text-zinc-400 italic">
              "Mide tu progreso real, te ayuda a equilibrar tu cuerpo y te mantiene motivado."
           </p>
        </section>

      </article>

    </div>
  `,
  styles: [`
    .fade-in { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class StrengthScoreInfoComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
