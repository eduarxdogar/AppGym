import { Component, computed, effect, input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { UiButtonComponent } from "../../shared/ui/ui-button/ui-button.component";

@Component({
  selector: 'app-exercise-timer',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    UiButtonComponent
  ],
  templateUrl: './exercise-timer.component.html',
})
export class ExerciseTimerComponent implements OnInit, OnDestroy {
  
  // Input flexible: puede ser number (segundos) o string ("90s", "2 min")
  restTime = input<string | number | undefined>('90s');

  // Opciones para el selector
  restTimeOptions: number[] = [30, 45, 60, 90, 120, 180, 240, 300];
  
  // Estado del timer
  selectedRestTime: number = 90;
  timeLeft: number = 90;
  isRunning: boolean = false;
  private intervalId: any;

  // Parseo a segundos para el Timer
  restSeconds = computed(() => {
    const val = this.restTime();
    if (typeof val === 'number') return val;
    
    if (!val) return 90; // Default fallback

    const str = val.toString().toLowerCase().trim();
    const num = parseFloat(str);

    if (isNaN(num)) return 90;

    if (str.includes('min')) {
      return Math.round(num * 60);
    }
    
    // Asumimos segundos si no dice min, o si dice 's'
    return Math.round(num);
  });

  constructor() {
    // Sincronizar input con selector si cambia externamente
    effect(() => {
      const seconds = this.restSeconds();
      this.selectedRestTime = seconds;
      if (!this.isRunning) {
        this.timeLeft = seconds;
      }
    });
  }

  ngOnInit(): void {
    // Inicialización explícita si es necesario
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  get timeFormatted(): string {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        this.onTimerComplete();
        this.pause(); // O reset(), según preferencia
      }
    }, 1000);
  }

  pause() {
    this.isRunning = false;
    this.clearTimer();
  }

  reset() {
    this.pause();
    this.timeLeft = this.selectedRestTime;
  }

  private clearTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onTimerComplete() {
      console.log('Descanso finalizado para este ejercicio');
      // Reproducir sonido o notificar
  }
}
