import { Component, inject, computed, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RecoveryService } from '../../../../core/services/recovery.service';
import { UserProfileStateService } from '../../../../core/services/user-profile-state.service';
import { UserProfileService } from '../../../../core/services/user-profile.service';
import { InbodyAiService } from '../../../../core/services/ai/inbody-ai.service';
import { NgtCanvas } from 'angular-three/dom';
import { BiometricModelComponent } from '../../../../shared/components/biometric-model/biometric-model.component';
import { SegmentalData } from '../../../../models/user-profile.model';

@Component({
  selector: 'app-recovery-monitor',
  standalone: true,
  imports: [CommonModule, MatIconModule, NgtCanvas, BiometricModelComponent],
  templateUrl: './recovery-monitor.component.html',
  styles: [`
    :host { display: block; }
    .hud-clip {
      clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
    }
  `]
})
export class RecoveryMonitorComponent {
  @ViewChild('inbodyFileInput') inbodyFileInput!: ElementRef<HTMLInputElement>;

  private recoveryService = inject(RecoveryService);
  private profileState = inject(UserProfileStateService);
  private profileService = inject(UserProfileService);
  private inbodyAi = inject(InbodyAiService);
  
  public statusMap = this.recoveryService.getMuscleRecoveryStatus();
  public profile = this.profileState.profile;
  
  selectedMuscle = computed(() => {
    const name = this.recoveryService.selectedMuscleName();
    if (!name) return null;
    const map = this.statusMap();
    return map.get(name) || null;
  });

  /** 80%+ recovery = ready to train */
  suggestedMuscles = computed(() => {
    const map = this.statusMap();
    const fresh = Array.from(map.values()).filter(m => m.percentage >= 80);
    return fresh.slice(0, 4);
  });

  /** All muscles sorted: most fatigued first */
  allMuscles = computed(() => {
    const map = this.statusMap();
    return Array.from(map.values()).sort((a, b) => a.percentage - b.percentage);
  });

  /** Controls the bottom sheet visibility */
  showSheet = signal(false);
  toggleSheet() { this.showSheet.update(v => !v); }
  closeSheet() { this.showSheet.set(false); }

  /** Controls the InBody re-scan modal */
  showRescanModal = signal(false);
  rescanState = signal<'idle' | 'scanning' | 'success' | 'error'>('idle');
  rescanMessage = signal('');

  openRescan() {
    this.rescanState.set('idle');
    this.rescanMessage.set('');
    this.showRescanModal.set(true);
  }
  closeRescan() { this.showRescanModal.set(false); }

  triggerFileInput() {
    this.inbodyFileInput.nativeElement.click();
  }

  async onInbodyFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.rescanState.set('scanning');
    this.rescanMessage.set('Analizando imagen con IA...');

    try {
      const base64 = await this.fileToBase64(file);
      const mimeType = file.type;
      const result = await this.inbodyAi.scanInBodyReport(base64, mimeType);

      const currentProfile = this.profile();
      if (!currentProfile) throw new Error('No hay perfil cargado');

      const updatedProfile = {
        ...currentProfile,
        inbodyData: {
          ...currentProfile.inbodyData,
          ...result,
          raw: `rescan-${new Date().toISOString()}`,
        }
      };

      await this.profileService.saveProfile(updatedProfile);
      this.profileState.refreshProfile();

      this.rescanState.set('success');
      this.rescanMessage.set('✓ InBody actualizado. El holograma se actualizará automáticamente.');
      
      // Auto-close after 2s
      setTimeout(() => this.closeRescan(), 2500);
    } catch (err: any) {
      this.rescanState.set('error');
      this.rescanMessage.set(err?.message || 'Error al procesar la imagen. Inténtalo de nuevo.');
    } finally {
      input.value = ''; // Reset input
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:image/...;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  closeHUD() {
    this.recoveryService.setSelectedMuscle(null);
  }

  getEtaHours(percentage: number): number {
    return Math.max(0, Math.round(48 * (1 - (percentage / 100))));
  }

  /**
   * Maps a muscle group name to its corresponding segmental InBody data.
   * Returns { muscle: string, fat: string } or null if no data.
   */
  getSegmentalInfo(muscleName: string): { muscle: string; fat: string } | null {
    const inbody = this.profile()?.inbodyData;
    if (!inbody?.segmentalMuscle && !inbody?.segmentalFat) return null;

    const sm = inbody.segmentalMuscle;
    const sf = inbody.segmentalFat;

    const ARM_MUSCLES = ['Bíceps', 'Tríceps', 'Antebrazos'];
    const LEG_MUSCLES = ['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'];
    const TRUNK_MUSCLES = ['Pecho', 'Espalda', 'Hombros', 'Core', 'Trapecio', 'Lumbares'];

    let muscleVal = '--';
    let fatVal = '--';

    if (ARM_MUSCLES.includes(muscleName)) {
      const rA = sm?.rightArm;
      const lA = sm?.leftArm;
      muscleVal = rA && lA ? `D:${rA} / I:${lA}` : (rA || lA || '--');
      const rfA = sf?.rightArm;
      const lfA = sf?.leftArm;
      fatVal = rfA && lfA ? `D:${rfA} / I:${lfA}` : (rfA || lfA || '--');
    } else if (LEG_MUSCLES.includes(muscleName)) {
      const rL = sm?.rightLeg;
      const lL = sm?.leftLeg;
      muscleVal = rL && lL ? `D:${rL} / I:${lL}` : (rL || lL || '--');
      const rfL = sf?.rightLeg;
      const lfL = sf?.leftLeg;
      fatVal = rfL && lfL ? `D:${rfL} / I:${lfL}` : (rfL || lfL || '--');
    } else if (TRUNK_MUSCLES.includes(muscleName)) {
      muscleVal = sm?.trunk || '--';
      fatVal = sf?.trunk || '--';
    }

    if (muscleVal === '--' && fatVal === '--') return null;
    return { muscle: muscleVal, fat: fatVal };
  }
}
