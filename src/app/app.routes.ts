import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { profileGuard } from './core/guards/profile.guard';
import { subscriptionGuard } from './core/guards/subscription.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/account/login/login.component').then(m => m.LoginComponent) },
  {
    path: 'trends/:type',
    loadComponent: () => import('./features/metrics/stats/trend-detail/trend-detail.component').then(m => m.TrendDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'stats',
    loadComponent: () => import('./features/metrics/stats/stats-detail/stats-detail.component').then(m => m.StatsDetailComponent),
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
        { path: 'dashboard', loadComponent: () => import('./features/metrics/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [profileGuard, subscriptionGuard] },
        { path: 'recovery-detail', loadComponent: () => import('./features/metrics/recovery-detail/recovery-detail.component').then(m => m.RecoveryDetailComponent) },
        { path: 'weekly-plan', loadComponent: () => import('./features/workouts/weekly-plan/weekly-plan.component').then(m => m.WeeklyPlanComponent), canActivate: [subscriptionGuard] },
        { path: 'strength-score-info', loadComponent: () => import('./features/metrics/strength-score-info/strength-score-info.component').then(m => m.StrengthScoreInfoComponent) },
        { path: 'profile', loadComponent: () => import('./features/account/profile/profile.component').then(m => m.ProfileComponent) },
        { path: 'onboarding', loadComponent: () => import('./features/account/onboarding/onboarding.component').then(m => m.OnboardingComponent) },
        { path: 'recovery', redirectTo: 'recovery-detail', pathMatch: 'full' },
        { path: 'workouts', loadComponent: () => import('./features/workouts/workout-list/workout-list.component').then(m => m.WorkoutListComponent) },
        { path: 'workouts/:id', loadComponent: () => import('./features/workouts/workout-detail/workout-detail.component').then(m => m.WorkoutDetailComponent) },
        { path: 'workout/:id/edit', loadComponent: () => import('./features/workouts/workout-edit/workout-edit.component').then(m => m.WorkoutEditComponent) },
        { path: 'calendar', loadComponent: () => import('./features/tools/calendar/calendar.component').then(m => m.CalendarComponent) },
        { path: 'timer', loadComponent: () => import('./features/tools/timer/timer.component').then(m => m.TimerComponent) },
        { path: 'generator', loadComponent: () => import('./features/generator/generator.component').then(m => m.GeneratorComponent), canActivate: [subscriptionGuard] },
        { path: 'workout-builder', loadComponent: () => import('./features/workouts/workout-builder/workout-builder.component').then(m => m.WorkoutBuilderComponent), canActivate: [subscriptionGuard] },
        { path: 'nutrition', canActivate: [profileGuard, subscriptionGuard], loadComponent: () => import('./features/nutrition/nutrition.component').then(m => m.NutritionComponent) },
        { path: 'cardio', canActivate: [profileGuard, subscriptionGuard], loadComponent: () => import('./features/cardio/cardio-boxing.component').then(m => m.CardioBoxingComponent) },
        { path: 'progress', loadComponent: () => import('./features/metrics/progress/progress.component').then(m => m.ProgressComponent) },
        { path: 'admin/exercises', loadComponent: () => import('./features/admin/admin-exercises/admin-exercises.component').then(m => m.AdminExercisesComponent) },
        { path: 'admin/users', canActivate: [adminGuard], loadComponent: () => import('./features/admin/admin-users/admin-users.component').then(m => m.AdminUsersComponent) },
        { path: 'billing', loadComponent: () => import('./features/account/billing/billing.component').then(m => m.BillingComponent) }
      ]
  },
  { path: '**', redirectTo: '/' }, 
];
 
