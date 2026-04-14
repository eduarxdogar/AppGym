import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AiCoachService, DietPlan } from '../../core/services/ai-coach.service';

@Component({
  selector: 'app-nutrition',
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
            <h1 class="text-xl font-bold uppercase tracking-wide">Nutrition Plan</h1>
            <p class="text-[10px] text-zinc-500 uppercase tracking-widest">AI Nutritionist</p>
          </div>
        </div>
        <div class="h-8 w-8 rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/30">
          <mat-icon class="text-pink-400 text-sm">restaurant</mat-icon>
        </div>
      </div>

      <div class="max-w-2xl mx-auto p-5 space-y-6">

        <!-- Config Form -->
        <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 class="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
            <mat-icon class="text-pink-400 text-sm">tune</mat-icon> Configuración
          </h2>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Objetivo</label>
              <select [(ngModel)]="goal" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 outline-none">
                <option value="volumen">Volumen Limpio</option>
                <option value="definicion">Definición</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="perdida_peso">Pérdida de Peso</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Peso (kg)</label>
              <input type="number" [(ngModel)]="weight" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 outline-none">
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Calorías Target</label>
              <input type="number" [(ngModel)]="targetCalories" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 outline-none">
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Comidas/día</label>
              <select [(ngModel)]="mealsPerDay" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 outline-none">
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
            </div>
          </div>

          <button (click)="generate()" [disabled]="isLoading()"
            class="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all
                   bg-pink-500 text-white hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-[0_0_15px_rgba(236,72,153,0.3)] flex items-center justify-center gap-2">
            <mat-icon *ngIf="!isLoading()" class="text-sm">auto_awesome</mat-icon>
            <mat-icon *ngIf="isLoading()" class="text-sm animate-spin">refresh</mat-icon>
            {{ isLoading() ? 'Generando plan...' : 'Generar Plan Nutricional' }}
          </button>
        </div>

        <!-- Error -->
        <div *ngIf="error()" class="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
          <mat-icon class="text-sm">error_outline</mat-icon> {{ error() }}
        </div>

        <!-- Results -->
        <div *ngIf="plan() as p" class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <!-- Macro Summary -->
          <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-5">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-sm font-bold text-zinc-300 uppercase tracking-widest">Resumen del Día</h2>
              <span class="text-xl font-black text-pink-400">{{ p.totalCalories }} kcal</span>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                <span class="block text-lg font-black text-blue-400">{{ p.macros.protein }}</span>
                <span class="block text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Proteína</span>
              </div>
              <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                <span class="block text-lg font-black text-yellow-400">{{ p.macros.carbs }}</span>
                <span class="block text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Carbos</span>
              </div>
              <div class="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                <span class="block text-lg font-black text-orange-400">{{ p.macros.fats }}</span>
                <span class="block text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Grasas</span>
              </div>
            </div>
          </div>

          <!-- Meals -->
          <div *ngFor="let meal of p.meals; let i = index"
               class="bg-[#151921] border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="font-bold text-white">{{ meal.name }}</h3>
                <span class="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                  <mat-icon class="text-xs w-3 h-3">schedule</mat-icon> {{ meal.time }}
                </span>
              </div>
              <span class="text-xs font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-1 rounded-full">
                {{ getMealCalories(meal) }} kcal
              </span>
            </div>
            <div class="space-y-2">
              <div *ngFor="let food of meal.foods"
                   class="flex justify-between items-center text-sm py-1.5 border-b border-zinc-800/50 last:border-0">
                <div>
                  <span class="text-zinc-300">{{ food.item }}</span>
                  <span class="text-zinc-600 text-xs ml-2">{{ food.amount }}</span>
                </div>
                <span class="text-zinc-500 text-xs font-mono">{{ food.calories }} kcal</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Empty State -->
        <div *ngIf="!plan() && !isLoading()" class="text-center py-16 text-zinc-600">
          <mat-icon class="text-6xl mb-4 opacity-30">restaurant_menu</mat-icon>
          <p class="text-sm">Configura tu perfil y genera tu plan nutricional personalizado.</p>
        </div>

      </div>
    </div>
  `
})
export class NutritionComponent {
  private aiCoach = inject(AiCoachService);

  goal = 'volumen';
  weight = 75;
  targetCalories = 3000;
  mealsPerDay = '5';

  isLoading = signal(false);
  plan = signal<DietPlan | null>(null);
  error = signal<string | null>(null);

  async generate() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.aiCoach.generateDietPlan(
        { goal: this.goal, weight: this.weight, mealsPerDay: +this.mealsPerDay },
        this.targetCalories
      );
      this.plan.set(result);
    } catch (err: any) {
      this.error.set('No se pudo generar el plan. Verifica tu API Key de Gemini.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getMealCalories(meal: DietPlan['meals'][0]): number {
    return meal.foods.reduce((sum, f) => sum + (f.calories || 0), 0);
  }
}
