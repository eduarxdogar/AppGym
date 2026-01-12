import { Routes } from '@angular/router';
import { WorkoutListComponent } from './components/workout-list/workout-list.component';
import { WorkoutDetailComponent } from './components/workout-detail/workout-detail.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { TimerComponent } from './features/timer/timer.component';
import { ProgressComponent } from './features/progress/progress.component';
import { WorkoutEditComponent } from './components/workout-edit/workout-edit.component';
import { LoginComponent } from './features/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RecoveryPageComponent } from './features/recovery/recovery.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { 
      path: '', 
      runGuardsAndResolvers: 'always',
      canActivate: [authGuard],
      children: [
        { path: 'dashboard', component: DashboardComponent },
        { path: 'recovery-detail', loadComponent: () => import('./features/recovery-detail/recovery-detail.component').then(m => m.RecoveryDetailComponent) },
        { path: 'weekly-plan', loadComponent: () => import('./features/weekly-plan/weekly-plan.component').then(m => m.WeeklyPlanComponent) },
        { path: 'strength-score-info', loadComponent: () => import('./features/strength-score-info/strength-score-info.component').then(m => m.StrengthScoreInfoComponent) },
        { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
        { path: 'recovery', redirectTo: 'recovery-detail', pathMatch: 'full' },
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
