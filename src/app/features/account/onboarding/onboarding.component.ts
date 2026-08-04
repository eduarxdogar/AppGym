import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { UserProfileStateService } from '../../../core/services/user-profile-state.service';
import { UserProfile } from '../../../core/models/user-profile.model';
import { InbodyAiService } from '../../../core/services/ai/inbody-ai.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserProfileSchema } from '../profile/schemas/user-profile.schema';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const EQUIPMENT = ['Mancuernas', 'Barra', 'Máquinas', 'Bandas', 'Polea', 'Kettlebells', 'Calistenia'];
const GYMS = ['Smart Fit', 'Bodytech', 'Athletic', 'Gimnasio de Barrio', 'Home Gym', 'Otro'];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.component.html',
  styles: [`
    .field {
      @apply w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white
             focus:border-[#CCFF00] outline-none transition-colors placeholder:text-zinc-600;
    }
  `]
})
export class OnboardingComponent {
  private readonly profileService = inject(UserProfileService);
  private readonly profileState = inject(UserProfileStateService);
  private readonly aiCoach = inject(InbodyAiService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  step = signal(0);
  isSaving = signal(false);
  error = signal<string | null>(null);
  inbodyPreview = signal<string | null>(null);
  inbodyFileName = signal<string | null>(null);
  inbodyIsPdf = signal(false);
  scanningInBody = signal(false);
  inbodyScanResult = signal<{
    muscleKg?: number | null;
    fatPercent?: number | null;
    bmr?: number | null;
    waterPercentage?: number | null;
    visceralFat?: number | null;
    boneMass?: number | null;
  } | null>(null);

  allDays = DAYS;
  allEquipment = EQUIPMENT;
  gyms = GYMS;

  profile: Partial<UserProfile> & { availableDays: string[]; equipment: string[]; baseGym: string } = {
    displayName: '',
    age: undefined,
    sex: 'male',
    weight: 75,
    height: 175,
    goal: 'volumen',
    fitnessLevel: 'Intermedio',
    availableDays: ['Lunes', 'Miércoles', 'Viernes'],
    equipment: ['Máquinas', 'Mancuernas'],
    baseGym: 'Gimnasio de Barrio'
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

    this.inbodyFileName.set(file.name);
    this.inbodyIsPdf.set(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const dataUrl = e.target.result as string;
      this.inbodyPreview.set(dataUrl);

      // Extract MimeType and Base64
      const mimeMatch = /data:([^;]+);base64/.exec(dataUrl);
      if (!mimeMatch) return;
      const mimeType = mimeMatch[1];
      const base64 = dataUrl.split(',')[1];

      this.scanningInBody.set(true);
      try {
        const result = await this.aiCoach.scanInBodyReport(base64, mimeType);
        this.inbodyScanResult.set(result);
        
        // Mapeo explícito para asegurar persistencia en Firestore
        this.profile.inbodyData = {
          muscleKg: result.muscleKg || null,
          fatPercent: result.fatPercent || null,
          bmr: result.bmr || null,
          waterPercentage: result.waterPercentage || null,
          visceralFat: result.visceralFat || null,
          boneMass: result.boneMass || null,
          segmentalMuscle: result.segmentalMuscle || undefined,
          segmentalFat: result.segmentalFat || undefined
        };
      } catch (err: unknown) {
        console.error('InBody Scan failed:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('resource-exhausted') || errorMsg.includes('429')) {
          this.toastService.showWarning('Límite de IA alcanzado. Por favor, intenta de nuevo en unos minutos.');
        } else {
          this.toastService.showError('Falla de conexión con el servidor IA.');
        }
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
      // Aseguramos que el payload incluya explícitamente los datos de InBody si existen
      // Sanitización estricta: Firestore no acepta 'undefined'. 
      // Convertimos campos opcionales a null o valores por defecto.
      const finalProfile: UserProfile = {
        displayName: this.profile.displayName || '',
        age: this.profile.age ?? null,
        sex: this.profile.sex || 'male',
        weight: this.profile.weight || 0,
        height: this.profile.height || 0,
        goal: this.profile.goal || 'volumen',
        fitnessLevel: this.profile.fitnessLevel || 'Intermedio',
        availableDays: this.profile.availableDays || [],
        equipment: this.profile.equipment || [],
        baseGym: this.profile.baseGym || 'Gimnasio de Barrio',
      };

      if (this.profile.inbodyData) {
        finalProfile.inbodyData = {
          muscleKg: this.profile.inbodyData.muscleKg ?? null,
          fatPercent: this.profile.inbodyData.fatPercent ?? null,
          bmr: this.profile.inbodyData.bmr ?? null,
          waterPercentage: this.profile.inbodyData.waterPercentage ?? null,
          visceralFat: this.profile.inbodyData.visceralFat ?? null,
          boneMass: this.profile.inbodyData.boneMass ?? null,
          segmentalMuscle: this.profile.inbodyData.segmentalMuscle ?? undefined,
          segmentalFat: this.profile.inbodyData.segmentalFat ?? undefined
        };
      }

      const validation = UserProfileSchema.safeParse(finalProfile);
      if (!validation.success) {
        console.error('Validation error:', validation.error);
        this.error.set('Datos de perfil inválidos. Revisa el formulario.');
        this.isSaving.set(false);
        return;
      }

      await this.profileService.saveProfile(validation.data);
      this.profileState.refreshProfile();
      this.router.navigate(['/weekly-plan'], { queryParams: { autoGenerate: 'true' } });
    } catch (err: unknown) {
      console.error('Save profile failed:', err);
      this.error.set('Error al guardar el perfil. Intenta de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }
}

