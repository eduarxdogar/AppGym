import { Component, inject, effect, signal, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Auth, updateProfile } from '@angular/fire/auth';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Functions, httpsCallable } from '@angular/fire/functions';

import { AuthService } from '../../../core/services/auth.service';
import { UserProfileStateService } from '../../../core/services/user-profile-state.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { GamificationService } from '../../../core/services/gamification.service';
import { DatabaseMigrationService } from '../../../core/services/database-migration.service';
import { MigrationReport } from '../../admin/models/admin.model';
import { UserProfileSchema } from './schemas/user-profile.schema';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly auth = inject(Auth);
  private readonly storage = inject(Storage);
  private readonly router = inject(Router);
  private readonly userProfileState = inject(UserProfileStateService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly gamificationService = inject(GamificationService);
  private readonly migrationService = inject(DatabaseMigrationService);
  private readonly functions = inject(Functions);

  /** True when running under `ng serve` (development mode). Controls dev-only UI. */
  readonly isDev = isDevMode();

  currentUser = this.authService.currentUser;
  isAdmin$ = this.authService.isAdmin$;
  userProfile = this.userProfileState.profile;
  gamificationState = this.gamificationService.gamificationState;

  availableEquipment = [
    { name: 'Polea', icon: 'cable' },
    { name: 'Máquina Smith', icon: 'view_in_ar' },
    { name: 'Máquinas', icon: 'settings' },
    { name: 'Mancuernas', icon: 'fitness_center' },
    { name: 'Barra', icon: 'horizontal_rule' },
    { name: 'Kettlebells', icon: 'sports_gymnastics' },
    { name: 'Bandas', icon: 'line_weight' },
    { name: 'Calistenia', icon: 'accessibility_new' }
  ];

  selectedEquipment = signal<string[]>([]);
  isSaving = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  isBillingLoading = signal<boolean>(false);

  // ── Migration state (dev-only) ────────────────────────────────────────────
  isMigrating = signal<boolean>(false);
  migrationReport = signal<MigrationReport | null>(null);

  constructor() {
    effect(() => {
      const profile = this.userProfileState.profile();
      if (profile?.equipment) {
        this.selectedEquipment.set([...profile.equipment]);
      }
    }, { allowSignalWrites: true });
  }

  toggleEquipment(item: string) {
     const current = this.selectedEquipment();
     if (current.includes(item)) {
        this.selectedEquipment.set(current.filter(eq => eq !== item));
     } else {
        this.selectedEquipment.set([...current, item]);
     }
  }

  async saveEquipment() {
     this.isSaving.set(true);
     try {
        const validation = UserProfileSchema.shape.equipment.safeParse(this.selectedEquipment());
        if (!validation.success) {
           console.error('Validation error:', validation.error);
           return;
        }
        await this.userProfileService.updateEquipment(validation.data);
        this.userProfileState.refreshProfile();
     } catch (error: unknown) {
        console.error('Error saving equipment:', error);
     } finally {
        this.isSaving.set(false);
     }
  }


  async uploadProfilePhoto(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const user = this.auth.currentUser;
    if (!user) return;

    this.isUploading.set(true);
    try {
      const filePath = `profilePhotos/${user.uid}/${file.name}`;
      const storageRef = ref(this.storage, filePath);
      
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      
      await updateProfile(user, { photoURL });
      
      window.location.reload(); 
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      this.isUploading.set(false);
    }
  }

  triggerFileInput() {
    document.getElementById('photoUpload')?.click();
  }

  async logout() {
    await this.authService.logout();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  async renewSubscription() {
    this.isBillingLoading.set(true);
    try {
      const checkout = httpsCallable<{ }, { init_point: string }>(this.functions, 'createCheckoutSession');
      const result = await checkout();
      
      if (result.data?.init_point) {
        globalThis.location.href = result.data.init_point;
      } else {
        throw new Error('No se recibió init_point desde el servidor');
      }
    } catch (error) {
      console.error('Error al generar la sesión de pago:', error);
    } finally {
      this.isBillingLoading.set(false);
    }
  }

  /**
   * DEV-ONLY: Runs the Firestore backfill migration.
   * Visible only in development builds (isDevMode() === true).
   */
  async runMigration() {
    if (this.isMigrating()) return;
    this.isMigrating.set(true);
    this.migrationReport.set(null);
    try {
      const report = await this.migrationService.migrateLegacyWorkoutHistory();
      this.migrationReport.set(report);
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      this.isMigrating.set(false);
    }
  }
}
