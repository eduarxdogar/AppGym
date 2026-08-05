import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AiCoachFloatingComponent } from '../../components/ai-coach-floating/ai-coach-floating.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AiCoachFloatingComponent],
  template: `
    <div class="app-layout w-full h-full">
      <router-outlet></router-outlet>
      <!-- Floating Action Button + Drawer for AI Coach -->
      <app-ai-coach-floating></app-ai-coach-floating>
    </div>
  `
})
export class MainLayoutComponent {}
