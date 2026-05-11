import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UserProfileService } from '../../core/services/user-profile.service';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { UserProfile } from '../../models/user-profile.model';
import { InbodyAiService } from '../../core/services/ai/inbody-ai.service';

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
  private readonly router = inject(Router);

  step = signal(0);
  isSaving = signal(false);
  error = signal<string | null>(null);
  inbodyPreview = signal<string | null>(null);
  scanningInBody = signal(false);
  inbodyScanResult = signal<{ muscleKg?: number; fatPercent?: number; bmr?: number } | null>(null);

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
        this.profile.inbodyData = result;
      } catch (err) {
        console.error('InBody Scan failed:', err);
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
      this.router.navigate(['/weekly-plan']);
    } catch (err: any) {
      this.error.set('Error al guardar el perfil. Intenta de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
