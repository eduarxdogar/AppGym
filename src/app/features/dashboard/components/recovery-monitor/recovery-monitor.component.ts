import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RecoveryService } from '../../../../core/services/recovery.service';
import { NgtCanvas } from 'angular-three/dom';
import { BiometricModelComponent } from '../../../../shared/components/biometric-model/biometric-model.component';

@Component({
  selector: 'app-recovery-monitor',
  standalone: true,
  imports: [CommonModule, MatIconModule, NgtCanvas, BiometricModelComponent],
  templateUrl: './recovery-monitor.component.html',
  styles: [`
    :host {
      display: block;
    }
    .hud-clip {
      clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
    }
  `]
})
export class RecoveryMonitorComponent {
  private recoveryService = inject(RecoveryService);
  
  public statusMap = this.recoveryService.getMuscleRecoveryStatus();
  
  selectedMuscle = computed(() => {
    const name = this.recoveryService.selectedMuscleName();
    if (!name) return null;
    const map = this.statusMap();
    return map.get(name) || null;
  });

  /** Limit to 4 suggested fresh muscles */
  suggestedMuscles = computed(() => {
    const map = this.statusMap();
    const fresh = Array.from(map.values()).filter(m => m.percentage >= 90);
    return fresh.slice(0, 4);
  });

  closeHUD() {
    this.recoveryService.setSelectedMuscle(null);
  }

  getEtaHours(percentage: number): number {
    return Math.max(0, Math.round(48 * (1 - (percentage / 100))));
  }
}
