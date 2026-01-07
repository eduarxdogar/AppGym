import { Component,EventEmitter, OnDestroy, Output  } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-timer',
  standalone: true,
  imports: [CommonModule, MatIconModule, UiButtonComponent, MatTooltipModule],
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss']
})
export class TimerComponent implements OnDestroy {
  
  @Output() finalizado = new EventEmitter<number>();

  time = 0;
  timeFormatted = '00:00';
  private subscription?: Subscription;

  start() {
    this.subscription = interval(1000).subscribe(() => {
      this.time++;
      this.timeFormatted = this.formatTime(this.time);
    });
  }

  pause() {
    this.subscription?.unsubscribe();
  }

  reset() {
    this.pause();
    this.time = 0;
    this.timeFormatted = '00:00';
  }

  private formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
  stopAndEmit() {
    this.pause();
    this.finalizado.emit(this.time);
  }
}
