import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workout-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workout-summary.component.html'
})
export class WorkoutSummaryComponent {
  // To be expanded in the future for a dedicated summary screen
}
