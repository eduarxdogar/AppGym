import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AiCoachService, WeeklyDietPlan, DayDietPlan } from '../../core/services/ai-coach.service';
import { NutritionService } from '../../core/services/nutrition.service';

interface ScannedFood {
  calories: number; protein: number; carbs: number; fats: number;
}

type MealOverrides = Record<number, ScannedFood>; // key = meal index

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
            <p class="text-[10px] text-zinc-500 uppercase tracking-widest">AI Nutritionist · Cronobiología</p>
          </div>
        </div>
        <button *ngIf="plan()" (click)="toggleForm()"
          class="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition">
          <mat-icon class="text-sm">refresh</mat-icon>
          {{ showForm() ? 'Cancelar' : 'Regenerar' }}
        </button>
      </div>

      <div class="max-w-2xl mx-auto p-5 space-y-6">

        <!-- Loading existing -->
        <div *ngIf="loadingExisting()" class="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
          <mat-icon class="text-4xl animate-spin">refresh</mat-icon>
          <p class="text-sm">Cargando tu plan...</p>
        </div>

        <!-- Config Form -->
        <div *ngIf="showForm() && !loadingExisting()" class="bg-[#151921] border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 class="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
            <mat-icon class="text-pink-400 text-sm">tune</mat-icon> Configuración Nutricional
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
                <option value="2">2</option><option value="3">3</option>
                <option value="4">4</option><option value="5">5</option><option value="6">6</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Protocolo Ayuno</label>
              <select [(ngModel)]="fastingProtocol" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 outline-none">
                <option value="Sin Ayuno">Sin Ayuno</option>
                <option value="16/8">Intermitente 16/8</option>
                <option value="18/6">Intermitente 18/6</option>
                <option value="OMAD">OMAD</option>
              </select>
            </div>
            <div [class.opacity-40]="fastingProtocol === 'Sin Ayuno'">
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Primera Comida</label>
              <input type="time" [(ngModel)]="firstMealTime" [disabled]="fastingProtocol === 'Sin Ayuno'"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 outline-none disabled:cursor-not-allowed">
            </div>
          </div>
          <button (click)="generate()" [disabled]="isLoading()"
            class="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider bg-pink-500 text-white hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(236,72,153,0.3)] flex items-center justify-center gap-2 transition">
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
        <div *ngIf="plan() && !showForm()" class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <!-- Overrides Banner -->
          <div *ngIf="hasOverrides()" class="bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-xl p-3 flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs text-[#CCFF00]">
              <mat-icon class="text-sm">camera_alt</mat-icon>
              <span class="font-bold">{{ overridesCount() }} comida(s) actualizada(s) con datos escaneados</span>
            </div>
            <button (click)="clearOverrides()" class="text-zinc-500 hover:text-white text-xs underline transition">Limpiar</button>
          </div>

          <!-- Day Tabs -->
          <div class="flex gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            <button (click)="activeTab.set('training')" class="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              [ngClass]="activeTab() === 'training' ? 'bg-pink-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'">
              <mat-icon class="text-xs mr-1">fitness_center</mat-icon>Entrenamiento
            </button>
            <button (click)="activeTab.set('rest')" class="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              [ngClass]="activeTab() === 'rest' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'">
              <mat-icon class="text-xs mr-1">self_improvement</mat-icon>Descanso
            </button>
          </div>

          <!-- Macro Summary (reactive with overrides) -->
          <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-5">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                {{ activeTab() === 'training' ? '💪 Día de Entrenamiento' : '🧘 Día de Descanso' }}
              </h2>
              <div class="text-right">
                <span class="text-xl font-black text-pink-400">{{ effectiveTotalCalories() }} kcal</span>
                <p *ngIf="hasOverrides()" class="text-[9px] text-[#CCFF00] mt-0.5">Actualizado con escaneos</p>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                <span class="block text-lg font-black text-blue-400">{{ activePlan()?.macros?.protein }}</span>
                <span class="block text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Proteína</span>
              </div>
              <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                <span class="block text-lg font-black text-yellow-400">{{ activePlan()?.macros?.carbs }}</span>
                <span class="block text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Carbos</span>
              </div>
              <div class="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                <span class="block text-lg font-black text-orange-400">{{ activePlan()?.macros?.fats }}</span>
                <span class="block text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Grasas</span>
              </div>
            </div>
          </div>

          <!-- Meals -->
          <ng-container *ngIf="activePlan() as p">

            <!-- Hidden file inputs (one per meal, identified by index) -->
            <input *ngFor="let meal of p.meals; let i = index"
              type="file" [id]="'scanInput-'+i" class="hidden"
              accept="image/*" capture="environment"
              (change)="onScanSelected($event, i)">

            <div *ngFor="let meal of p.meals; let i = index"
                 class="bg-[#151921] border rounded-2xl p-5 hover:border-zinc-700 transition"
                 [ngClass]="mealOverrides()[i] ? 'border-[#CCFF00]/30' : 'border-zinc-800'">

              <div class="flex justify-between items-start mb-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-bold text-white">{{ meal.name }}</h3>
                    <span *ngIf="mealOverrides()[i]" class="text-[9px] px-1.5 py-0.5 rounded-full bg-[#CCFF00]/20 text-[#CCFF00] font-bold">ESCANEADO</span>
                  </div>
                  <span class="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                    <mat-icon class="text-xs w-3 h-3">schedule</mat-icon> {{ meal.time }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <!-- Loading spinner for this meal -->
                  <mat-icon *ngIf="scanningMealIndex() === i" class="text-sm text-pink-400 animate-spin">refresh</mat-icon>
                  <!-- Actual kcal badge -->
                  <span class="text-xs font-bold px-2 py-1 rounded-full border"
                    [ngClass]="mealOverrides()[i]
                      ? 'text-[#CCFF00] bg-[#CCFF00]/10 border-[#CCFF00]/30'
                      : 'text-pink-400 bg-pink-500/10 border-pink-500/20'">
                    {{ mealOverrides()[i] ? mealOverrides()[i].calories : getMealCalories(meal) }} kcal
                  </span>
                  <!-- Scan button -->
                  <label [for]="'scanInput-'+i"
                    class="h-8 w-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center cursor-pointer hover:bg-zinc-700 hover:text-white transition"
                    title="Escanear etiqueta nutricional">
                    <mat-icon class="text-sm">camera_alt</mat-icon>
                  </label>
                </div>
              </div>

              <!-- Scanned result overlay -->
              <div *ngIf="mealOverrides()[i] as scan" class="mb-3 p-3 rounded-xl bg-[#CCFF00]/5 border border-[#CCFF00]/20">
                <p class="text-[10px] text-[#CCFF00] font-bold uppercase tracking-wider mb-2">Valores escaneados</p>
                <div class="grid grid-cols-4 gap-2 text-center text-xs">
                  <div><span class="block font-bold text-white">{{ scan.calories }}</span><span class="text-zinc-500">kcal</span></div>
                  <div><span class="block font-bold text-blue-400">{{ scan.protein }}g</span><span class="text-zinc-500">Prot</span></div>
                  <div><span class="block font-bold text-yellow-400">{{ scan.carbs }}g</span><span class="text-zinc-500">Carbos</span></div>
                  <div><span class="block font-bold text-orange-400">{{ scan.fats }}g</span><span class="text-zinc-500">Grasas</span></div>
                </div>
                <button (click)="removeOverride(i)" class="text-[10px] text-zinc-500 hover:text-red-400 mt-2 transition">✕ Quitar y usar plan original</button>
              </div>

              <!-- Original foods (dimmed if overridden) -->
              <div class="space-y-1.5" [class.opacity-40]="!!mealOverrides()[i]">
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
          </ng-container>

        </div>

        <!-- Empty State -->
        <div *ngIf="!plan() && !isLoading() && !loadingExisting()" class="text-center py-16 text-zinc-600">
          <mat-icon class="text-6xl mb-4 opacity-30">restaurant_menu</mat-icon>
          <p class="text-sm">Configura tu perfil y genera tu plan nutricional personalizado.</p>
        </div>

      </div>
    </div>
  `
})
export class NutritionComponent implements OnInit {
  private aiCoach = inject(AiCoachService);
  private nutritionService = inject(NutritionService);

  // Form
  goal = 'volumen';
  weight = 75;
  targetCalories = 3000;
  mealsPerDay = '4';
  fastingProtocol = 'Sin Ayuno';
  firstMealTime = '12:00';

  // UI
  isLoading = signal(false);
  loadingExisting = signal(true);
  showForm = signal(false);
  activeTab = signal<'training' | 'rest'>('training');
  error = signal<string | null>(null);
  scanningMealIndex = signal<number | null>(null);

  // Data
  plan = signal<WeeklyDietPlan | null>(null);
  mealOverrides = signal<MealOverrides>({});

  // Computed
  activePlan = computed((): DayDietPlan | null => {
    const p = this.plan();
    if (!p) return null;
    return this.activeTab() === 'training' ? p.trainingDay : p.restDay;
  });

  effectiveTotalCalories = computed((): number => {
    const p = this.activePlan();
    if (!p) return 0;
    const overrides = this.mealOverrides();
    if (!Object.keys(overrides).length) return p.totalCalories;
    // Recalculate: sum scanned overrides + original non-overridden meals
    return p.meals.reduce((sum, meal, i) => {
      if (overrides[i]) return sum + overrides[i].calories;
      return sum + meal.foods.reduce((s, f) => s + (f.calories || 0), 0);
    }, 0);
  });

  hasOverrides = computed(() => Object.keys(this.mealOverrides()).length > 0);
  overridesCount = computed(() => Object.keys(this.mealOverrides()).length);

  ngOnInit() {
    this.nutritionService.getPlan().subscribe({
      next: (existing) => {
        if (existing) {
          this.plan.set(existing);
          this.showForm.set(false);
        } else {
          this.showForm.set(true);
        }
        this.loadingExisting.set(false);
      },
      error: () => {
        this.showForm.set(true);
        this.loadingExisting.set(false);
      }
    });
  }

  toggleForm() {
    this.showForm.update(v => !v);
    this.error.set(null);
  }

  async generate() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.aiCoach.generateDietPlan(
        { goal: this.goal, weight: this.weight, mealsPerDay: +this.mealsPerDay,
          fastingProtocol: this.fastingProtocol, firstMealTime: this.firstMealTime },
        this.targetCalories
      );
      this.plan.set(result);
      this.mealOverrides.set({});
      this.showForm.set(false);
      await this.nutritionService.savePlan(result);
    } catch {
      this.error.set('No se pudo generar el plan. Verifica tu API Key de Gemini.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onScanSelected(event: any, mealIndex: number) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const dataUrl = e.target.result as string;
      const mimeMatch = dataUrl.match(/data:([^;]+);base64/);
      if (!mimeMatch) return;
      const mimeType = mimeMatch[1];
      const base64 = dataUrl.split(',')[1];
      this.scanningMealIndex.set(mealIndex);
      try {
        const scanned = await this.aiCoach.scanNutritionLabel(base64, mimeType);
        this.mealOverrides.update(overrides => ({ ...overrides, [mealIndex]: scanned }));
      } catch {
        this.error.set('No se pudo leer la etiqueta. Intenta con una foto más clara.');
      } finally {
        this.scanningMealIndex.set(null);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  removeOverride(mealIndex: number) {
    this.mealOverrides.update(o => {
      const copy = { ...o };
      delete copy[mealIndex];
      return copy;
    });
  }

  clearOverrides() { this.mealOverrides.set({}); }

  getMealCalories(meal: DayDietPlan['meals'][0]): number {
    return meal.foods.reduce((sum, f) => sum + (f.calories || 0), 0);
  }
}
