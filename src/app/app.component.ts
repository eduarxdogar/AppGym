import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AiCoachDrawerComponent } from './shared/components/ai-coach-drawer/ai-coach-drawer.component';
import { CommonModule } from '@angular/common';
import { UiStateService } from './core/services/ui-state.service';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ExerciseSeederService } from './core/services/exercise-seeder.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, AiCoachDrawerComponent, CommonModule, MatIconModule, DragDropModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'fitness-app';
  uiState = inject(UiStateService);
  private exerciseSeeder = inject(ExerciseSeederService);

  ngOnInit() {
    this.exerciseSeeder.runSeeder();
  }
}
