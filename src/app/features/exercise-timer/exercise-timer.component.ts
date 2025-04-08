import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-exercise-timer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatFormFieldModule, MatInputModule],
  templateUrl: './exercise-timer.component.html',
})
export class ExerciseTimerComponent implements OnDestroy {
  // Duración total seleccionada para el descanso (en segundos)
  selectedDuration: number = 300;
  // La cuenta regresiva se inicia en el valor seleccionado
  remainingTime: number = this.selectedDuration;
  timeFormatted: string = this.formatTime(this.remainingTime);

  // Variable para almacenar la suscripción al intervalo
  private subscription?: Subscription;
  // Bandera para saber si el cronómetro está corriendo
  isRunning: boolean = false;

  // Opciones disponibles para el selector (segundos)
  restTimeOptions: number[] = [5,60, 180,300];
  // Tiempo de descanso seleccionado (valor por defecto 60)
  selectedRestTime: number = 300;

  /**
   * Inicia el cronómetro de cuenta regresiva.
   * Cada segundo actualiza el tiempo restante y el formato.
   * Cuando llega a cero, detiene el cronómetro y reproduce un beep.
   */
  start() {
    // Usamos el valor seleccionado tanto para duración total como para la cuenta inicial
    this.selectedDuration = this.selectedRestTime;
    this.remainingTime = this.selectedDuration;
    this.timeFormatted = this.formatTime(this.remainingTime);
    this.isRunning = true;

    // Cancelamos cualquier suscripción previa
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // Usamos un intervalo de 1 segundo para actualizar la cuenta regresiva
    this.subscription = interval(1000).subscribe(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.timeFormatted = this.formatTime(this.remainingTime);
      } else {
        // Cuando se termina la cuenta, se pausa y se reproduce el beep
        this.pause();
        this.playBeep();
      }
    });
    console.log('Cronómetro iniciado. Duración:', this.selectedDuration, 'segundos');
  }

  /**
   * Pausa el cronómetro cancelando la suscripción.
   */
  pause() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
    this.isRunning = false;
    console.log('Cronómetro pausado.');
  }

  /**
   * Reinicia el cronómetro a la duración seleccionada.
   */
  reset() {
    this.pause();
    this.remainingTime = this.selectedDuration;
    this.timeFormatted = this.formatTime(this.remainingTime);
    console.log('Cronómetro reseteado.');
  }

  /**
   * Reproduce un sonido beep desde el asset 'assets/beep.mp3'.
   */
  playBeep() {
    const audio = new Audio('assets/beep.mp3');
    audio.play().catch(error => {
      console.error('Error al reproducir beep:', error);
    });
  }

  /**
   * Formatea el tiempo en formato MM:SS.
   * @param seconds Número de segundos.
   * @returns Cadena formateada.
   */
  private formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
