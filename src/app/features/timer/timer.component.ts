import { Component, EventEmitter, OnDestroy, Output, OnInit, input } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-timer',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss']
})
export class TimerComponent implements OnInit, OnDestroy {
  
  // Inputs & Outputs
  duration = input<number>(90); // Default 90 seconds
  @Output() finalizado = new EventEmitter<void>();
  @Output() pauseEvent = new EventEmitter<void>();

  // Circular Timer Props
  radius = 40;
  circumference = 2 * Math.PI * this.radius;
  
  // Timer State
  timeLeft = 90;
  initialDuration = 90;
  timeFormatted = '01:30';
  isRunning = false;
  isFinished = false;
  
  private subscription?: Subscription;
  private audio = new Audio('assets/beep.mp3');

  constructor() {
     this.audio.volume = 0.5; // Reasonable volume
  }

  ngOnInit() {
    // Initialize with input duration
    this.initialDuration = this.duration();
    this.reset();
  }

  get dashOffset(): number {
    // Calculate progress (Full -> Empty)
    // When timeLeft == initialDuration, progress = 1, offset = 0 (Full)
    // When timeLeft == 0, progress = 0, offset = circumference (Empty)
    // Important: Avoid division by zero
    const total = this.initialDuration || 1; 
    const progress = this.timeLeft / total;
    return this.circumference * (1 - progress);
  }

  get strokeColor(): string {
     if (this.isFinished) return '#CCFC7E'; // Neon Green (Success)
     if (this.timeLeft <= 10) return '#ef4444'; // Red (Warning)
     return '#facc15'; // Yellow (Rest)
  }

  start() {
    if (this.isRunning || this.isFinished) return;
    this.isRunning = true;
    this.audio.load();

    this.subscription = interval(1000).subscribe(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
        this.timeFormatted = this.formatTime(this.timeLeft);
        
        // Audio Checks (3, 2, 1)
        if (this.timeLeft > 0 && this.timeLeft <= 3) {
            this.audio.play().catch(e => console.warn('Audio blocked', e));
        }
      } else {
        this.finish();
      }
    });
  }

  pause() {
    this.isRunning = false;
    this.subscription?.unsubscribe();
    this.pauseEvent.emit();
  }

  reset() {
    this.pause();
    this.isFinished = false;
    this.timeLeft = this.initialDuration; // Reset to what logic started with or input? 
    // Usually input, but if user adjusted? Let's stick to initial duration logic or update initial if adjusted?
    // User requirement: "Permite sumar +30s o -10s". Usually temporary.
    // Reset should go back to default Duration.
    // However, if user changd `duration` input, `initialDuration` might need update via effect, but simpler to just read signal.
    this.initialDuration = this.duration(); 
    this.timeLeft = this.initialDuration;
    this.timeFormatted = this.formatTime(this.timeLeft);
  }
  
  finish() {
    this.pause();
    this.isFinished = true;
    this.timeLeft = 0;
    this.timeFormatted = "LISTO";
    this.audio.play(); // Final beep
    this.finalizado.emit();
  }

  adjustTime(seconds: number) {
    this.timeLeft += seconds;
    if (this.timeLeft < 0) this.timeLeft = 0;
    
    // Optional: Update initial duration if we want the bar to strictly reflect new scale?
    // Or just let bar jump? User "Input Rápido".
    // If we add 30s, timeLeft might exceed initialDuration. Bar would be > Full (negative offset).
    // Let's allow bar to stay full if timeLeft > initialDuration, or update initial to clamp max?
    // Better UX: Update initialDuration to match timeLeft if timeLeft > initialDuration, 
    // so bar is full and drains.
    if (this.timeLeft > this.initialDuration) {
        this.initialDuration = this.timeLeft;
    }
    
    this.timeFormatted = this.formatTime(this.timeLeft);
  }

  private formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
