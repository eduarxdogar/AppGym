import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RestTimerService, REST_PRESETS_SECONDS } from '../../../../core/services/rest-timer.service';
import { WorkoutSessionService } from '../../services/workout-session.service';

@Component({
  selector: 'app-rest-timer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './rest-timer.component.html'
})
export class RestTimerComponent {
  public restTimer = inject(RestTimerService);
  public sessionService = inject(WorkoutSessionService);
  public restPresets = REST_PRESETS_SECONDS;
  
  showRestModal = false;

  openRestModal() {
    this.showRestModal = true;
  }

  closeRestModal() {
    this.showRestModal = false;
  }
}
