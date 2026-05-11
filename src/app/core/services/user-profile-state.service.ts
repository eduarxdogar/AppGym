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

  private _profile = signal<UserProfile | null>(null);
  readonly profile = this._profile.asReadonly();

  constructor() {
    this.authService.authState$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(user => {
      if (user) {
        this.refreshProfile();
      } else {
        this._profile.set(null);
      }
    });
  }

  refreshProfile(): void {
    this.userProfileService.getProfile().subscribe(profileData => {
      this._profile.set(profileData);
    });
  }
}
