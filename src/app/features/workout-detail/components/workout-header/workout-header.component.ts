import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-workout-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './workout-header.component.html'
})
export class WorkoutHeaderComponent {
  sessionTimeFormatted = input.required<string>();
  timerProgress = input.required<number>();
  
  cancel = output<void>();
  save = output<void>();
}
