import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AiCoachDrawerComponent } from './shared/components/ai-coach-drawer/ai-coach-drawer.component';
import { CommonModule } from '@angular/common';
import { UiStateService } from './core/services/ui-state.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, AiCoachDrawerComponent, CommonModule, MatIconModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'fitness-app';
  uiState = inject(UiStateService);
}
