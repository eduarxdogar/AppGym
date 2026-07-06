import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserProfileService } from './user-profile.service';
import { AuthService } from './auth.service';
import { UserProfile } from '../../models/user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class UserProfileStateService {
  private userProfileService = inject(UserProfileService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  /**
   * Estado del perfil con tres posibles valores:
   * - `undefined` : carga inicial en progreso (loading state).
   * - `null`      : usuario autenticado pero sin perfil en Firestore.
   * - `UserProfile`: perfil cargado exitosamente.
   */
  private _profile = signal<UserProfile | null | undefined>(undefined);
  readonly profile = this._profile.asReadonly();

  constructor() {
    this.authService.authState$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(user => {
      if (user) {
        this.refreshProfile();
      } else {
        // Usuario deslogueado: reseteamos a null (no undefined)
        this._profile.set(null);
      }
    });
  }

  refreshProfile(): void {
    // Marcamos como loading antes de la petición
    this._profile.set(undefined);
    this.userProfileService.getProfile().subscribe(profileData => {
      this._profile.set(profileData);
    });
  }
}
