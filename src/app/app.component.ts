import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { UiStateService } from './core/services/ui-state.service';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ExerciseSeederService } from './features/workouts/services/exercise-seeder.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, MatIconModule, DragDropModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  title = 'fitness-app';
  uiState = inject(UiStateService);
  private readonly exerciseSeeder = inject(ExerciseSeederService);

  ngOnInit() {
    this.exerciseSeeder.runSeeder();
  }
}
