import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AiCoachService, BoxingRoutine } from '../../core/services/ai-coach.service';
import { CardioSessionService } from '../../core/services/cardio-session.service';

@Component({
  selector: 'app-cardio-boxing',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#0B0E14] text-white pb-20 font-sans">

      <!-- Header -->
      <div class="sticky top-0 z-50 bg-[#0B0E14]/90 backdrop-blur-md border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button [routerLink]="['/dashboard']" class="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div>
            <h1 class="text-xl font-bold uppercase tracking-wide">Cardio & Boxing</h1>
            <p class="text-[10px] text-zinc-500 uppercase tracking-widest">AI Boxing Coach</p>
          </div>
        </div>
        <div class="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
          <mat-icon class="text-blue-400 text-sm">sports_mma</mat-icon>
        </div>
      </div>

      <div class="max-w-2xl mx-auto p-5 space-y-6">

        <!-- Config Form -->
        <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 class="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
            <mat-icon class="text-blue-400 text-sm">tune</mat-icon> Configuración
          </h2>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Nivel</label>
              <select [(ngModel)]="level" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none">
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Duración (min)</label>
              <select [(ngModel)]="duration" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none">
                <option value="20">20 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
          </div>

          <button (click)="generate()" [disabled]="isLoading()"
            class="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all
                   bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2">
            <mat-icon *ngIf="!isLoading()" class="text-sm">sports_mma</mat-icon>
            <mat-icon *ngIf="isLoading()" class="text-sm animate-spin">refresh</mat-icon>
            {{ isLoading() ? 'Generando rutina...' : 'Generar Sesión de Boxeo' }}
          </button>
        </div>

        <!-- Error -->
        <div *ngIf="error()" class="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
          <mat-icon class="text-sm">error_outline</mat-icon> {{ error() }}
        </div>

        <!-- Results -->
        <div *ngIf="routine() as r" class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <!-- Title Card -->
          <div class="bg-gradient-to-r from-blue-900/40 to-[#151921] border border-blue-500/30 rounded-2xl p-5 flex justify-between items-center">
            <div>
              <h2 class="text-lg font-black text-white">{{ r.title }}</h2>
              <p class="text-xs text-blue-400 flex items-center gap-1 mt-1">
                <mat-icon class="text-xs w-3 h-3">schedule</mat-icon> {{ r.totalDuration }} minutos totales
              </p>
            </div>
            <mat-icon class="text-blue-400 text-4xl opacity-50">sports_mma</mat-icon>
          </div>

          <!-- Warmup -->
          <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-5">
            <h3 class="text-sm font-bold text-[#CCFF00] uppercase tracking-widest mb-3 flex items-center gap-2">
              <mat-icon class="text-sm">local_fire_department</mat-icon> Calentamiento
            </h3>
            <ul class="space-y-2">
              <li *ngFor="let item of r.warmup" class="flex items-start gap-2 text-sm text-zinc-300">
                <mat-icon class="text-zinc-600 text-xs mt-1 flex-shrink-0">chevron_right</mat-icon>
                {{ item }}
              </li>
            </ul>
          </div>

          <!-- Rounds -->
          <div *ngFor="let round of r.rounds; let i = index"
               class="bg-[#151921] border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition relative overflow-hidden">
            <!-- Focus Badge -->
            <div class="absolute top-0 right-0 m-3">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    [ngClass]="{
                      'bg-blue-500/20 text-blue-400 border border-blue-500/30': round.focus === 'Cardio',
                      'bg-[#CCFF00]/20 text-[#CCFF00] border border-[#CCFF00]/30': round.focus === 'Technique',
                      'bg-red-500/20 text-red-400 border border-red-500/30': round.focus === 'Power'
                    }">
                {{ round.focus }}
              </span>
            </div>
            <div class="flex items-center gap-3 mb-3">
              <div class="h-8 w-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-black text-blue-400">
                {{ round.roundNumber }}
              </div>
              <div>
                <span class="font-bold text-white text-sm">Round {{ round.roundNumber }}</span>
                <span class="text-xs text-zinc-500 ml-2">{{ round.duration }}</span>
              </div>
            </div>
            <p class="text-sm text-zinc-300 leading-relaxed pl-11">{{ round.instructions }}</p>
          </div>

          <!-- Cooldown -->
          <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-5 mb-6">
            <h3 class="text-sm font-bold text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <mat-icon class="text-sm">self_improvement</mat-icon> Cooldown
            </h3>
            <ul class="space-y-2">
              <li *ngFor="let item of r.cooldown" class="flex items-start gap-2 text-sm text-zinc-300">
                <mat-icon class="text-zinc-600 text-xs mt-1 flex-shrink-0">chevron_right</mat-icon>
                {{ item }}
              </li>
            </ul>
          </div>

          <!-- Save Button -->
          <button (click)="saveSession()" [disabled]="isSaving()"
            class="w-full py-4 rounded-xl font-black text-lg uppercase tracking-wider transition-all
                   bg-[#CCFF00] text-black hover:bg-[#bce600] disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-[0_0_20px_rgba(204,255,0,0.3)] flex items-center justify-center gap-2">
            <mat-icon *ngIf="isSaving()" class="text-sm animate-spin">refresh</mat-icon>
            <mat-icon *ngIf="!isSaving()" class="text-lg">done_all</mat-icon>
            {{ isSaving() ? 'Guardando...' : 'Finalizar Sesión' }}
          </button>

        </div>

        <!-- Empty State -->
        <div *ngIf="!routine() && !isLoading()" class="text-center py-16 text-zinc-600">
          <mat-icon class="text-6xl mb-4 opacity-30">sports_mma</mat-icon>
          <p class="text-sm">Configura tu sesión y genera tu rutina de boxeo y cardio personalizada.</p>
        </div>

      </div>
    </div>
  `
})
export class CardioBoxingComponent {
  private aiCoach = inject(AiCoachService);
  private cardioService = inject(CardioSessionService);
  private router = inject(Router);

  level = 'Intermedio';
  duration = '30';

  isLoading = signal(false);
  isSaving = signal(false);
  routine = signal<BoxingRoutine | null>(null);
  error = signal<string | null>(null);

  async generate() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.aiCoach.generateBoxingRoutine(this.level, +this.duration);
      this.routine.set(result);
    } catch (err: any) {
      this.error.set('No se pudo generar la rutina. Verifica tu API Key de Gemini.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveSession() {
    const r = this.routine();
    if (!r) return;
    this.isSaving.set(true);
    try {
      // 8 METs para boxeo en 75kg
      const cals = Math.round((r.totalDuration / 60) * 8.0 * 75);
      await this.cardioService.saveSession({
        date: new Date().toISOString(),
        durationMinutes: r.totalDuration,
        title: r.title,
        level: this.level,
        caloriesBurned: cals
      });
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error.set('No se pudo guardar la sesión en Firebase.');
      this.isSaving.set(false);
    }
  }
}
