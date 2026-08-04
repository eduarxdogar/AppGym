import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MuscleStatus } from '../../../features/metrics/services/recovery.service';

@Component({
  selector: 'app-professional-body-map',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    /* SVG Muscle Styles */
    .neon-red { 
      fill: rgba(255, 0, 0, 0.2); 
      stroke: #FF0000;
      stroke-width: 1.5px;
      filter: drop-shadow(0 0 12px rgba(255, 0, 0, 0.9));
      animation: flicker 3s infinite alternate;
      cursor: pointer;
    }
    .neon-yellow { 
      fill: rgba(255, 215, 0, 0.2); 
      stroke: #FFD700;
      stroke-width: 1px;
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.6));
      transition: all 0.5s ease;
      cursor: pointer;
    }
    .neon-green { 
      fill: rgba(204, 255, 0, 0.15); 
      stroke: #CCFF00;
      stroke-width: 1px;
      filter: drop-shadow(0 0 5px rgba(204, 255, 0, 0.4));
      animation: pulse-green 4s infinite ease-in-out;
      cursor: pointer;
    }
    .base-dark { 
      fill: transparent; 
      stroke: #27272a; 
      stroke-width: 1px; 
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .base-dark:hover { 
      fill: rgba(204, 255, 0, 0.05); 
      stroke: #CCFF00;
      filter: drop-shadow(0 0 5px rgba(204, 255, 0, 0.5));
    }
    
    /* Animations */
    @keyframes flicker {
      0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
      20%, 24%, 55% { opacity: 0.4; }
    }
    @keyframes pulse-green {
      0%, 100% { opacity: 0.7; filter: drop-shadow(0 0 5px rgba(204, 255, 0, 0.4)); }
      50% { opacity: 1; filter: drop-shadow(0 0 15px rgba(204, 255, 0, 0.8)); }
    }
    @keyframes subtle-scan {
      0% { transform: translateY(0); }
      100% { transform: translateY(600px); }
    }
    
    /* Cyber-Lab Container */
    .grid-bg {
      background-image: linear-gradient(rgba(204, 255, 0, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(204, 255, 0, 0.03) 1px, transparent 1px);
      background-size: 30px 30px;
    }
    .scan-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background: rgba(204, 255, 0, 0.8);
      box-shadow: 0 0 15px 3px rgba(204, 255, 0, 0.5);
      animation: subtle-scan 5s linear infinite;
      z-index: 20;
      pointer-events: none;
    }

    /* Flip Container 3D */
    .flip-container {
      perspective: 1000px;
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
      height: 600px;
      position: relative;
    }
    .flip-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      transform-style: preserve-3d;
    }
    .flip-inner.is-flipped {
      transform: rotateY(180deg);
    }
    .flip-front, .flip-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .flip-back {
      transform: rotateY(180deg);
    }
  `],
  templateUrl: './professional-body-map.component.html',
})
export class ProfessionalBodyMapComponent {
  recoveryStatus = input.required<Map<string, MuscleStatus>>();
  muscleClicked = output<string>();
  
  isFlipped = signal(false);

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

    if (percentage <= 30) return 'neon-red';
    if (percentage <= 85) return 'neon-yellow';
    return 'neon-green';
  }

  toggleFlip() {
    this.isFlipped.update(v => !v);
  }

  onMuscleClick(targetName: string) {
    this.muscleClicked.emit(targetName);
  }
}
