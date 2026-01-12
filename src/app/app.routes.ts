import { Routes } from '@angular/router';
import { WorkoutListComponent } from './components/workout-list/workout-list.component';
import { WorkoutDetailComponent } from './components/workout-detail/workout-detail.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { TimerComponent } from './features/timer/timer.component';
import { ProgressComponent } from './features/progress/progress.component';
import { WorkoutEditComponent } from './components/workout-edit/workout-edit.component';
import { LoginComponent } from './features/login/login.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'workouts', pathMatch: 'full' },
  { 
      path: '', 
      runGuardsAndResolvers: 'always',
      canActivate: [authGuard],
      children: [
        { path: 'workouts', component: WorkoutListComponent },
        { path: 'workouts/:id', component: WorkoutDetailComponent },
        { path: 'calendar', component: CalendarComponent },
        { path: 'timer', component: TimerComponent },
        { path: 'workout/:id/edit', component: WorkoutEditComponent },
        { path: 'generator', loadComponent: () => import('./features/generator/generator.component').then(m => m.GeneratorComponent) },
        { path: 'progress', component: ProgressComponent },
      ]
  },
  { path: '**', redirectTo: '/' }, 
];
