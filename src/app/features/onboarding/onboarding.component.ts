import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UserProfileService } from '../../core/services/user-profile.service';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { UserProfile } from '../../models/user-profile.model';
import { AiCoachService } from '../../core/services/ai-coach.service';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const EQUIPMENT = ['Mancuernas', 'Barra', 'Máquinas', 'Bandas', 'Polea', 'Kettlebells', 'Calistenia'];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#0B0E14] text-white font-sans flex flex-col">

      <!-- Ambient BG -->
      <div class="fixed inset-0 pointer-events-none">
        <div class="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] bg-[#CCFF00]/5 rounded-full blur-[120px]"></div>
        <div class="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div class="relative z-10 flex-1 flex flex-col max-w-lg mx-auto w-full px-5 py-8">

        <!-- Logo / Title -->
        <div class="text-center mb-8">
          <div class="h-14 w-14 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(204,255,0,0.15)]">
            <mat-icon class="text-[#CCFF00] text-3xl">fitness_center</mat-icon>
          </div>
          <h1 class="text-2xl font-black uppercase tracking-wide">Configura tu <span class="text-[#CCFF00]">Perfil</span></h1>
          <p class="text-zinc-500 text-xs mt-1 uppercase tracking-widest">Paso {{ step() + 1 }} de 3</p>
        </div>

        <!-- Progress Bar -->
        <div class="flex gap-1.5 mb-8">
          <div *ngFor="let s of [0,1,2]"
               class="h-1 flex-1 rounded-full transition-all duration-500"
               [ngClass]="s <= step() ? 'bg-[#CCFF00]' : 'bg-zinc-800'"></div>
        </div>

        <!-- ───── STEP 0: Biometría ───── -->
        <div *ngIf="step() === 0" class="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <h2 class="text-lg font-bold text-white">Tus datos biométricos</h2>
          <p class="text-zinc-500 text-xs">Necesitamos estos datos para calibrar tus planes de entrenamiento y nutrición.</p>

          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Nombre que usarás</label>
              <input [(ngModel)]="profile.displayName" type="text" placeholder="ej. Carlos" class="field">
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Edad</label>
              <input [(ngModel)]="profile.age" type="number" placeholder="25" class="field">
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Sexo</label>
              <select [(ngModel)]="profile.sex" class="field">
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Peso (kg)</label>
              <input [(ngModel)]="profile.weight" type="number" placeholder="75" class="field">
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Altura (cm)</label>
              <input [(ngModel)]="profile.height" type="number" placeholder="175" class="field">
            </div>
            <div class="col-span-2">
              <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Objetivo Principal</label>
              <select [(ngModel)]="profile.goal" class="field">
                <option value="volumen">Ganar Músculo (Volumen)</option>
                <option value="definicion">Definición / Grasa</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="perdida_peso">Pérdida de Peso</option>
              </select>
            </div>
          </div>
        </div>

        <!-- ───── STEP 1: Nivel & Disponibilidad ───── -->
        <div *ngIf="step() === 1" class="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <h2 class="text-lg font-bold text-white">Nivel y disponibilidad</h2>
          <p class="text-zinc-500 text-xs">Esto permite al AI Coach ajustar la dificultad y la frecuencia de tus rutinas.</p>

          <div>
            <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Nivel de Experiencia</label>
            <div class="grid grid-cols-3 gap-2">
              <button *ngFor="let lvl of ['Principiante','Intermedio','Avanzado']"
                      (click)="setLevel(lvl)"
                      class="py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border"
                      [ngClass]="profile.fitnessLevel === lvl
                        ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'">
                {{ lvl }}
              </button>
            </div>
          </div>

          <div>
            <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Días Disponibles</label>
            <div class="flex flex-wrap gap-2">
              <button *ngFor="let day of allDays"
                      (click)="toggleDay(day)"
                      class="px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
                      [ngClass]="profile.availableDays.includes(day)
                        ? 'bg-[#CCFF00]/20 text-[#CCFF00] border-[#CCFF00]/40'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'">
                {{ day }}
              </button>
            </div>
          </div>

          <div>
            <label class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Equipamiento Disponible</label>
            <div class="flex flex-wrap gap-2">
              <button *ngFor="let eq of allEquipment"
                      (click)="toggleEquipment(eq)"
                      class="px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
                      [ngClass]="profile.equipment.includes(eq)
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'">
                {{ eq }}
              </button>
            </div>
          </div>
        </div>

        <!-- ───── STEP 2: InBody (Opcional) ───── -->
        <div *ngIf="step() === 2" class="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div class="flex items-start gap-3">
            <div>
              <h2 class="text-lg font-bold text-white">Análisis InBody</h2>
              <p class="text-zinc-500 text-xs mt-1">Opcional. Sube una foto de tu reporte InBody para que el Coach extraiga tu composición corporal de forma automática.</p>
            </div>
            <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 flex-shrink-0 mt-1">Opcional</span>
          </div>

          <!-- Upload Zone -->
          <input type="file" #inbodyInput class="hidden" (change)="onInBodySelected($event)" accept="image/*">
          <div (click)="inbodyInput.click()"
               class="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all"
               [ngClass]="inbodyPreview() ? 'border-[#CCFF00]/40 bg-[#CCFF00]/5' : 'border-zinc-700 hover:border-zinc-500'">
            <ng-container *ngIf="!inbodyPreview()">
              <mat-icon class="text-zinc-600 text-4xl mb-3">upload_file</mat-icon>
              <p class="text-zinc-400 text-sm font-bold">Sube tu reporte InBody</p>
              <p class="text-zinc-600 text-xs mt-1">Tap para seleccionar imagen</p>
            </ng-container>
            <ng-container *ngIf="inbodyPreview()">
              <img [src]="inbodyPreview()!" class="h-32 mx-auto rounded-lg object-contain mb-2">
              <p class="text-[#CCFF00] text-xs font-bold">Imagen lista para análisis ✓</p>
            </ng-container>
          </div>

          <!-- Scan Result -->
          <div *ngIf="inbodyScanResult()" class="bg-[#151921] border border-[#CCFF00]/20 rounded-2xl p-4 space-y-2">
            <p class="text-[10px] text-[#CCFF00] uppercase tracking-widest font-bold flex items-center gap-1">
              <mat-icon class="text-xs">check_circle</mat-icon> InBody extraído por AI
            </p>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <span class="block text-lg font-black text-white">{{ inbodyScanResult()?.muscleKg || '—' }} kg</span>
                <span class="block text-[9px] text-zinc-500 uppercase">Músculo</span>
              </div>
              <div>
                <span class="block text-lg font-black text-white">{{ inbodyScanResult()?.fatPercent || '—' }}%</span>
                <span class="block text-[9px] text-zinc-500 uppercase">Grasa</span>
              </div>
              <div>
                <span class="block text-lg font-black text-white">{{ inbodyScanResult()?.bmr || '—' }}</span>
                <span class="block text-[9px] text-zinc-500 uppercase">TMB kcal</span>
              </div>
            </div>
          </div>

          <div *ngIf="scanningInBody()" class="flex items-center justify-center gap-3 py-4 text-zinc-400">
            <mat-icon class="animate-spin">refresh</mat-icon>
            <span class="text-sm">Analizando con Gemini Vision...</span>
          </div>

          <div *ngIf="!inbodyPreview() && !scanningInBody()" class="text-center">
            <p class="text-zinc-600 text-xs">O puedes <button (click)="saveProfile()" class="text-zinc-400 underline">saltar este paso</button> y añadirlo después.</p>
          </div>
        </div>

        <!-- Error -->
        <div *ngIf="error()" class="mt-4 bg-red-900/20 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2">
          <mat-icon class="text-sm">error_outline</mat-icon> {{ error() }}
        </div>

        <!-- Navigation Buttons -->
        <div class="mt-8 flex gap-3">
          <button *ngIf="step() > 0"
                  (click)="prevStep()"
                  class="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-bold uppercase tracking-wider hover:bg-zinc-800 transition">
            Atrás
          </button>
          <button *ngIf="step() < 2"
                  (click)="nextStep()"
                  [disabled]="!canProceed()"
                  class="flex-1 py-3 rounded-xl bg-[#CCFF00] text-black text-sm font-bold uppercase tracking-wider hover:bg-[#bce600] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-[0_0_20px_rgba(204,255,0,0.2)]">
            Continuar
          </button>
          <button *ngIf="step() === 2"
                  (click)="saveProfile()"
                  [disabled]="isSaving()"
                  class="flex-1 py-3 rounded-xl bg-[#CCFF00] text-black text-sm font-bold uppercase tracking-wider hover:bg-[#bce600] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-[0_0_20px_rgba(204,255,0,0.2)] flex items-center justify-center gap-2">
            <mat-icon *ngIf="isSaving()" class="text-sm animate-spin">refresh</mat-icon>
            {{ isSaving() ? 'Guardando...' : '¡Activar Protocolo!' }}
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .field {
      @apply w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white
             focus:border-[#CCFF00] outline-none transition-colors placeholder:text-zinc-600;
    }
  `]
})
export class OnboardingComponent {
  private profileService = inject(UserProfileService);
  private profileState = inject(UserProfileStateService);
  private aiCoach = inject(AiCoachService);
  private router = inject(Router);

  step = signal(0);
  isSaving = signal(false);
  error = signal<string | null>(null);
  inbodyPreview = signal<string | null>(null);
  scanningInBody = signal(false);
  inbodyScanResult = signal<{ muscleKg?: number; fatPercent?: number; bmr?: number } | null>(null);

  allDays = DAYS;
  allEquipment = EQUIPMENT;

  profile: Partial<UserProfile> & { availableDays: string[]; equipment: string[] } = {
    displayName: '',
    age: undefined,
    sex: 'male',
    weight: 75,
    height: 175,
    goal: 'volumen',
    fitnessLevel: 'Intermedio',
    availableDays: ['Lunes', 'Miércoles', 'Viernes'],
    equipment: ['Máquinas', 'Mancuernas']
  };

  canProceed(): boolean {
    if (this.step() === 0) return !!(this.profile.weight && this.profile.height && this.profile.goal);
    if (this.step() === 1) return this.profile.availableDays.length > 0;
    return true;
  }

  nextStep() {
    if (this.canProceed() && this.step() < 2) this.step.update(s => s + 1);
  }
  prevStep() { if (this.step() > 0) this.step.update(s => s - 1); }

  setLevel(lvl: string) {
    this.profile.fitnessLevel = lvl as any;
  }

  toggleDay(day: string) {
    if (this.profile.availableDays.includes(day)) {
      this.profile.availableDays = this.profile.availableDays.filter(d => d !== day);
    } else {
      this.profile.availableDays = [...this.profile.availableDays, day];
    }
  }

  toggleEquipment(eq: string) {
    if (this.profile.equipment.includes(eq)) {
      this.profile.equipment = this.profile.equipment.filter(e => e !== eq);
    } else {
      this.profile.equipment = [...this.profile.equipment, eq];
    }
  }

  async onInBodySelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const dataUrl = e.target.result as string;
      this.inbodyPreview.set(dataUrl);

      // Extract MimeType and Base64
      const mimeMatch = dataUrl.match(/data:([^;]+);base64/);
      if (!mimeMatch) return;
      const mimeType = mimeMatch[1];
      const base64 = dataUrl.split(',')[1];

      this.scanningInBody.set(true);
      try {
        const result = await this.aiCoach.scanInBodyReport(base64, mimeType);
        this.inbodyScanResult.set(result);
        this.profile.inbodyData = result;
      } catch {
        // Silently fail – InBody is optional
      } finally {
        this.scanningInBody.set(false);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async saveProfile() {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      await this.profileService.saveProfile(this.profile as UserProfile);
      this.profileState.refreshProfile();
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set('Error al guardar el perfil. Intenta de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
