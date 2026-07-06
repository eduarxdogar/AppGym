import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { profileGuard } from './core/guards/profile.guard';
import { subscriptionGuard } from './core/guards/subscription.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
  {
    path: 'trends/:type',
    loadComponent: () => import('./features/stats/trend-detail/trend-detail.component').then(m => m.TrendDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'stats',
    loadComponent: () => import('./features/stats/stats-detail/stats-detail.component').then(m => m.StatsDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
      path: '',
      runGuardsAndResolvers: 'always',
      canActivate: [authGuard],
      children: [
        { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [profileGuard, subscriptionGuard] },
        { path: 'recovery-detail', loadComponent: () => import('./features/recovery-detail/recovery-detail.component').then(m => m.RecoveryDetailComponent) },
        { path: 'weekly-plan', loadComponent: () => import('./features/weekly-plan/weekly-plan.component').then(m => m.WeeklyPlanComponent), canActivate: [subscriptionGuard] },
        { path: 'strength-score-info', loadComponent: () => import('./features/strength-score-info/strength-score-info.component').then(m => m.StrengthScoreInfoComponent) },
        { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
        { path: 'onboarding', loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent) },
        { path: 'recovery', redirectTo: 'recovery-detail', pathMatch: 'full' },
        { path: 'workouts', loadComponent: () => import('./components/workout-list/workout-list.component').then(m => m.WorkoutListComponent) },
        { path: 'workouts/:id', loadComponent: () => import('./features/workout-detail/workout-detail.component').then(m => m.WorkoutDetailComponent) },
        { path: 'calendar', loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent) },
        { path: 'timer', loadComponent: () => import('./features/timer/timer.component').then(m => m.TimerComponent) },
        { path: 'workout/:id/edit', loadComponent: () => import('./components/workout-edit/workout-edit.component').then(m => m.WorkoutEditComponent) },
        { path: 'generator', loadComponent: () => import('./features/generator/generator.component').then(m => m.GeneratorComponent), canActivate: [subscriptionGuard] },
        { path: 'workout-builder', loadComponent: () => import('./features/workout-builder/workout-builder.component').then(m => m.WorkoutBuilderComponent), canActivate: [subscriptionGuard] },
        { path: 'nutrition', canActivate: [profileGuard, subscriptionGuard], loadComponent: () => import('./features/nutrition/nutrition.component').then(m => m.NutritionComponent) },
        { path: 'cardio', canActivate: [profileGuard, subscriptionGuard], loadComponent: () => import('./features/cardio/cardio-boxing.component').then(m => m.CardioBoxingComponent) },
        { path: 'progress', loadComponent: () => import('./features/progress/progress.component').then(m => m.ProgressComponent) },
        { path: 'admin/exercises', loadComponent: () => import('./features/admin-exercises/admin-exercises.component').then(m => m.AdminExercisesComponent) },
        { path: 'admin/users', canActivate: [adminGuard], loadComponent: () => import('./features/admin-users/admin-users.component').then(m => m.AdminUsersComponent) },
        { path: 'billing', loadComponent: () => import('./features/billing/billing.component').then(m => m.BillingComponent) }
      ]
  },
  { path: '**', redirectTo: '/' }, 
];
 
