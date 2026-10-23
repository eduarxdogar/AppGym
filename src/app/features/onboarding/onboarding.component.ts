import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UserProfileService } from '../../core/services/user-profile.service';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { UserProfile } from '../../core/models/user-profile.model';
import { InbodyAiService } from '../../core/services/ai/inbody-ai.service';
import { ToastService } from '../../core/services/toast.service';
import { UserProfileSchema } from '../profile/schemas/user-profile.schema';
import { AVAILABLE_DAYS, ProfileBasicsSchema } from '../../core/models/onboarding.validation';
import { InbodyScanResult } from '../../core/models/inbody-scan.schema';
import { aiErrorMessage } from '../../core/utils/ai-error-message';
import { readInbodyFile } from '../../core/utils/inbody-file';
import { profileEquipment } from '../../core/models/equipment';

const EQUIPMENT = ['Mancuernas', 'Barra', 'Máquinas', 'Bandas', 'Polea', 'Kettlebells', 'Calistenia'];
const GYMS = ['Smart Fit', 'Bodytech', 'Athletic', 'Gimnasio de Barrio', 'Home Gym', 'Calistenia', 'Otro'];

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
  inbodyScanResult = signal<InbodyScanResult | null>(null);

  allDays = AVAILABLE_DAYS;
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
    baseGym: ''
  };

  canProceed(): boolean {
    if (this.step() === 0) return UserProfileSchema.pick({ weight: true, height: true, goal: true }).strip().safeParse(this.profile).success;
    if (this.step() === 1) return ProfileBasicsSchema.pick({ fitnessLevel: true, availableDays: true }).safeParse(this.profile).success;
    return true;
  }

  nextStep() {
    if (this.canProceed() && this.step() < 2) this.step.update(s => s + 1);
  }
  prevStep() { if (this.step() > 0) this.step.update(s => s - 1); }

  setLevel(lvl: string) {
    const level = ProfileBasicsSchema.shape.fitnessLevel.safeParse(lvl);
    if (level.success) this.profile.fitnessLevel = level.data;
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

  async onInBodySelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || this.scanningInBody() || this.isSaving()) return;
    input.value = '';
    this.scanningInBody.set(true);
    let reading = true;
    try {
      const upload = await readInbodyFile(file);
      reading = false;
      const result = await this.aiCoach.scanInBodyReport(upload.base64, upload.mimeType);
      // Apply only a validated result, preserving any earlier valid report on failure.
      this.inbodyFileName.set(file.name);
      this.inbodyIsPdf.set(upload.mimeType === 'application/pdf');
      this.inbodyPreview.set(upload.dataUrl);
      this.inbodyScanResult.set(result);
      this.profile.inbodyData = result;
    } catch (error: unknown) {
      this.toastService.showError(reading && error instanceof Error ? error.message
        : aiErrorMessage(error, 'No pudimos analizar el reporte. Intenta de nuevo o continúa sin InBody.'));
    } finally {
      this.scanningInBody.set(false);
    }
  }

  async saveProfile() {
    if (this.isSaving() || this.scanningInBody()) return;
    this.isSaving.set(true);
    this.error.set(null);
    try {
      const finalProfile = {
        ...this.profile,
        availableEquipment: profileEquipment(this.profile),
        equipment: profileEquipment(this.profile).includes('BODYWEIGHT') ? ['Calistenia'] : this.profile.equipment,
        age: this.profile.age ?? null,
        onboardingCompleted: true,
      };

      const validation = UserProfileSchema.safeParse(finalProfile);
      if (!validation.success) {
        console.error('Validation error:', validation.error);
        this.error.set('Datos de perfil inválidos. Revisa el formulario.');
        return;
      }

      await this.profileService.saveProfile(validation.data);
      this.profileState.refreshProfile();
      await this.router.navigate(['/weekly-plan'], { queryParams: { autoGenerate: 'true' } });
    } catch (err: unknown) {
      console.error('Save profile failed:', err);
      this.error.set('Error al guardar el perfil. Intenta de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }
}

