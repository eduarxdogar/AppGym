import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { RecoveryMonitorComponent } from '../../features/dashboard/components/recovery-monitor/recovery-monitor.component';
import { WorkoutCardComponent } from './ui/workout-card/workout-card.component';
import { WorkoutListStore } from './store/workout-list.store';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [MatIconModule, UiCardComponent, UiButtonComponent, RecoveryMonitorComponent, WorkoutCardComponent],
  templateUrl: './workout-list.component.html',
  providers: [WorkoutListStore]
})
export class WorkoutListComponent {
  public readonly store = inject(WorkoutListStore);
  public readonly router = inject(Router);

  generateAiRoutine() {
    this.router.navigate(['/generator']);
  }

  viewWorkout(id: string) {
    this.router.navigate(['/workouts', id]);
  }

  editWorkout(id: string) {
    this.router.navigate(['/workout', id, 'edit']);
  }
}
