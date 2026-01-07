import { Routes } from '@angular/router';
import { WorkoutListComponent } from './components/workout-list/workout-list.component';
import { WorkoutDetailComponent } from './components/workout-detail/workout-detail.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { TimerComponent } from './features/timer/timer.component';
import { ProgressComponent } from './features/progress/progress.component';
import { WorkoutEditComponent } from './components/workout-edit/workout-edit.component';

export const routes: Routes = [
  { path: '', redirectTo: 'workouts', pathMatch: 'full' },
  { path: 'workouts', component: WorkoutListComponent },
  { path: 'workouts/:id', component: WorkoutDetailComponent },
  { path: 'calendar', component: CalendarComponent },
  { path: 'timer', component: TimerComponent },
  { path: 'workout/:id/edit', component: WorkoutEditComponent }, // Nueva ruta de edición
  { path: 'generator', loadComponent: () => import('./features/generator/generator.component').then(m => m.GeneratorComponent) },
  { path: 'progress', component: ProgressComponent },
  { path: '**', redirectTo: '/' }, // Redirección para rutas inválidas

];
