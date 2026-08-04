import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MuscleStatus } from '../../../features/metrics/services/recovery.service';

@Component({
  selector: 'app-human-body',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './human-body.component.html',
})
export class HumanBodyComponent {
  // Recibimos el mapa completo de estados (nombre -> MuscleStatus)
  // Se adapta para aceptar Map<string, MuscleStatus> que es lo que tiene el servicio
  recoveryStatus = input.required<Map<string, MuscleStatus>>();

  getColor(muscleName: string): string {
    const statusIdx = this.recoveryStatus();
    
    // Búsqueda flexible (case insensitive y parcial)
    const normalizedTarget = muscleName.toLowerCase();
    
    // Buscar en las claves del mapa
    const key = Array.from(statusIdx.keys()).find(k => k.toLowerCase().includes(normalizedTarget));
    
    if (!key) return 'fill-zinc-700'; // Default: No entrenado / Sin datos

    const status = statusIdx.get(key);
    if (!status) return 'fill-zinc-700';

    const percent = status.percentage;

    if (percent <= 40) return 'fill-red-500';
    if (percent <= 80) return 'fill-yellow-500';
    return 'fill-green-500';
  }
}
