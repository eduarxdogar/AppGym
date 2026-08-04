import { Injectable, inject, signal, computed } from '@angular/core';
import { AdminUsersQueries } from '../api/admin-users.queries';
import { AdminUsersCommands } from '../api/admin-users.commands';
import { AdminUserRow } from '../models/admin-users.models';
import { ToastService } from '../../../core/services/toast.service';

@Injectable()
export class AdminUsersStore {
  private readonly queries = inject(AdminUsersQueries);
  private readonly commands = inject(AdminUsersCommands);
  private readonly toastService = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly users = signal<AdminUserRow[]>([]);
  readonly deletingUid = signal<string | null>(null);
  readonly seedingUid = signal<string | null>(null);
  readonly showConfirm = signal<boolean>(false);
  readonly pendingUser = signal<AdminUserRow | null>(null);

  readonly totalUsers = computed(() => this.users().length);
  readonly activeUsers = computed(() => this.users().filter(u => !u.isDeleted).length);
  readonly deletedUsers = computed(() => this.users().filter(u => u.isDeleted).length);

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const profiles = await this.queries.getAllProfiles();
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
      await this.commands.hardDeleteAccount(user.uid);
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
      await this.commands.seedTestData(user);
      this.toastService.showSuccess(`¡4 semanas de datos inyectados para ${user.displayName || user.email}!`);
    } catch (err: any) {
      console.error('[AdminUsers] Error seeding data:', err);
      this.toastService.showError('Error inyectando datos de prueba.');
    } finally {
      this.seedingUid.set(null);
    }
  }
}
