import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MuscleStatus } from '../../../core/services/recovery.service';

@Component({
  selector: 'app-professional-body-map',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .neon-red { 
      fill: #ef4444; 
      filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.9)); 
      stroke: #fca5a5;
      stroke-width: 1px;
      transition: all 0.5s ease;
    }
    .neon-yellow { 
      fill: #eab308; 
      filter: drop-shadow(0 0 6px rgba(234, 179, 8, 0.7)); 
      stroke: #fde047;
      stroke-width: 1px;
      transition: all 0.5s ease;
    }
    .neon-green { 
      fill: #10b981; 
      filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.5)); 
      stroke: #6ee7b7;
      stroke-width: 1px;
      transition: all 0.5s ease;
    }
    .base-dark { 
      fill: #18181b; 
      stroke: #27272a; 
      stroke-width: 1px; 
      transition: all 0.3s ease;
    }
    .base-dark:hover { 
      fill: #27272a; 
      stroke: #3f3f46;
    }
    .grid-bg {
      background-image: linear-gradient(rgba(34, 197, 94, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(34, 197, 94, 0.05) 1px, transparent 1px);
      background-size: 20px 20px;
    }
  `],
  templateUrl: './professional-body-map.component.html',
})
export class ProfessionalBodyMapComponent {
  recoveryStatus = input.required<Map<string, MuscleStatus>>();

  private getStatusForMuscle(targetName: string): MuscleStatus | undefined {
    const statusMap = this.recoveryStatus();
    targetName = targetName.toLowerCase();
    
    // 1. Direct Hit
    const key = Array.from(statusMap.keys()).find(k => k.toLowerCase().includes(targetName));
    if (key) return statusMap.get(key);

    // 2. Fallbacks
    if (targetName === 'lumbares' || targetName === 'trapecio' || targetName === 'dorsales') {
      const backKey = Array.from(statusMap.keys()).find(k => k.toLowerCase().includes('espalda'));
      if (backKey) return statusMap.get(backKey);
    }

    return undefined;
  }

  getColor(muscleName: string): string {
    const status = this.getStatusForMuscle(muscleName);
    
    if (!status) return 'base-dark'; // Clase default

    const percentage = status.percentage;

    if (percentage <= 40) return 'neon-red';
    if (percentage <= 80) return 'neon-yellow';
    return 'neon-green';
  }
}
