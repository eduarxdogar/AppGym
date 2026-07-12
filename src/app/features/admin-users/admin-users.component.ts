import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { UserProfileService } from '../../core/services/user-profile.service';
import { ToastService } from '../../core/services/toast.service';
import { UserProfile } from '../../models/user-profile.model';

type AdminUserRow = UserProfile & { uid: string };

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent implements OnInit {
  private readonly profileService = inject(UserProfileService);
  private readonly toastService = inject(ToastService);
  private readonly firestore = inject(Firestore);

  // ── State ──────────────────────────────────────────────
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly users = signal<AdminUserRow[]>([]);
  readonly deletingUid = signal<string | null>(null);
  readonly seedingUid = signal<string | null>(null);
  readonly showConfirm = signal<boolean>(false);
  readonly pendingUser = signal<AdminUserRow | null>(null);

  // ── Computed stats ─────────────────────────────────────
  readonly totalUsers = computed(() => this.users().length);
  readonly activeUsers = computed(() => this.users().filter(u => !u.isDeleted).length);
  readonly deletedUsers = computed(() => this.users().filter(u => u.isDeleted).length);

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const profiles = await this.profileService.getAllProfiles();
      this.users.set(profiles);
    } catch (err: any) {
      console.error('[AdminUsers] Error cargando perfiles:', err);
      this.error.set(err?.message ?? 'Error desconocido al consultar Firestore.');
    } finally {
      this.isLoading.set(false);
    }
  }

  confirmHardDelete(user: AdminUserRow): void {
    this.pendingUser.set(user);
    this.showConfirm.set(true);
  }

  cancelHardDelete(): void {
    this.showConfirm.set(false);
    this.pendingUser.set(null);
  }

  async executeHardDelete(): Promise<void> {
    const user = this.pendingUser();
    if (!user) return;

    this.showConfirm.set(false);
    this.deletingUid.set(user.uid);

    try {
      await this.profileService.hardDeleteAccount(user.uid);
      this.users.update(list => list.filter(u => u.uid !== user.uid));
      this.toastService.showSuccess(`Usuario "${user.displayName || user.uid}" eliminado permanentemente.`);
    } catch (err: any) {
      console.error('[AdminUsers] Error en hard delete:', err);
      this.toastService.showError(err?.message ?? 'No se pudo eliminar el usuario.');
    } finally {
      this.deletingUid.set(null);
      this.pendingUser.set(null);
    }
  }

  async seedTestData(user: AdminUserRow): Promise<void> {
    if (this.seedingUid() || this.deletingUid()) return;
    this.seedingUid.set(user.uid);

    try {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      const weeksAgo = [28, 21, 14, 7]; // Semana 1 (hace 28 días), Semana 2 (21)...

      const dayNames = ['Día 1 - Pecho/Tríceps', 'Día 2 - Espalda/Bíceps', 'Día 3 - Piernas/Hombros'];

      for (let week = 0; week < 4; week++) {
        const weekStartMs = now - (weeksAgo[week] * ONE_DAY);
        const weightProgression = 50 + (week * 2.5); // 50kg -> 52.5kg -> 55kg -> 57.5kg

        for (let day = 0; day < 3; day++) {
          const workoutDateMs = weekStartMs + (day * ONE_DAY);
          const dateStr = new Date(workoutDateMs).toISOString();
          
          const workoutId = crypto.randomUUID();
          const workoutRef = doc(this.firestore, `users/${user.uid}/workouts/${workoutId}`);
          
          await setDoc(workoutRef, {
            id: workoutId,
            nombre: dayNames[day],
            fecha: dateStr,
            isCompleted: true,
            status: 'completed',
            ejercicios: [
              {
                id: 'ex-press-banca',
                nombre: 'Press de Banca Plano',
                grupoMuscular: 'Pecho',
                series: 3,
                repeticiones: 10,
                pesokg: weightProgression,
                tipos: 'normal'
              },
              {
                id: 'ex-sentadilla',
                nombre: 'Sentadilla Libre',
                grupoMuscular: 'Piernas',
                series: 3,
                repeticiones: 10,
                pesokg: weightProgression + 10,
                tipos: 'normal'
              }
            ],
            // History/Progression Engine usa 'exercises' con 'sets' para leer el esfuerzo real
            exercises: [
               {
                  id: 'ex-press-banca',
                  nombre: 'Press de Banca Plano',
                  sets: [
                    { reps: 10, weight: weightProgression, completed: true },
                    { reps: 10, weight: weightProgression, completed: true },
                    { reps: 10, weight: weightProgression, completed: true }
                  ]
               },
               {
                  id: 'ex-sentadilla',
                  nombre: 'Sentadilla Libre',
                  sets: [
                    { reps: 10, weight: weightProgression + 10, completed: true },
                    { reps: 10, weight: weightProgression + 10, completed: true },
                    { reps: 10, weight: weightProgression + 10, completed: true }
                  ]
               }
            ]
          });
        }
      }
      this.toastService.showSuccess(`¡4 semanas de datos inyectados para ${user.displayName || user.email}!`);
    } catch (err: any) {
      console.error('[AdminUsers] Error seeding data:', err);
      this.toastService.showError('Error inyectando datos de prueba.');
    } finally {
      this.seedingUid.set(null);
    }
  }

  subscriptionLabel(status?: string): string {
    const labels: Record<string, string> = {
      active: 'Activo',
      trialing: 'Trial',
      past_due: 'Vencido',
      canceled: 'Cancelado',
    };
    return labels[status ?? ''] ?? 'Sin Plan';
  }

  formatDeletedAt(ts?: number): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
}
