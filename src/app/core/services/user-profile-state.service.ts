import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserProfileService } from './user-profile.service';
import { catchError, of, startWith, Subject, switchMap } from 'rxjs';
import { UserProfile } from '../../core/models/user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class UserProfileStateService {
  private readonly userProfileService = inject(UserProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh = new Subject<void>();

  /**
   * Estado del perfil con tres posibles valores:
   * - `undefined` : carga inicial en progreso (loading state).
   * - `null`      : usuario autenticado pero sin perfil en Firestore.
   * - `UserProfile`: perfil cargado exitosamente.
   */
  private readonly _profile = signal<UserProfile | null | undefined>(undefined);
  readonly profile = this._profile.asReadonly();

  constructor() {
    this.refresh.pipe(
      startWith(undefined),
      switchMap(() => this.userProfileService.getProfile().pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(profile => this._profile.set(profile));
  }

  refreshProfile(): void {
    // Marcamos como loading antes de la petición
    this._profile.set(undefined);
    this.refresh.next();
  }
}

