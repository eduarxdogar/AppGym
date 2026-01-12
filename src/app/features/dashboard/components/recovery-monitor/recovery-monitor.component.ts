import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RecoveryService, MuscleStatus } from '../../../../core/services/recovery.service';
import { ProfessionalBodyMapComponent } from '../../../../shared/components/professional-body-map/professional-body-map.component';

@Component({
  selector: 'app-recovery-monitor',
  standalone: true,
  imports: [CommonModule, MatIconModule, ProfessionalBodyMapComponent],
  templateUrl: './recovery-monitor.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class RecoveryMonitorComponent {
  private recoveryService = inject(RecoveryService);
  
  // Signal directo del servicio
  public statusMap = this.recoveryService.getMuscleRecoveryStatus();

  /**
   * Lista ordenada de músculos:
   * 1. Menor porcentaje (más fatigados) primero.
   */
  sortedMuscles = computed(() => {
    const map = this.statusMap();
    return Array.from(map.values()).sort((a, b) => a.percentage - b.percentage);
  });

  /**
   * Lista de músculos sugeridos (100% recuperados)
   * Limitado a 4 sugerencias para no saturar.
   */
  suggestedMuscles = computed(() => {
    const fresh = this.sortedMuscles().filter(m => m.percentage >= 90);
    // Priorizamos los que llevan más tiempo sin entrenar (si tuviéramos esa info exacta,
    // pero por ahora filtramos los más frescos).
    // shuffle o simplemente devolver los primeros.
    return fresh.slice(0, 4);
  });

  constructor() {}
}
