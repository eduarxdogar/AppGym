import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserProfileService } from './user-profile.service';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private userProfileService = inject(UserProfileService);

  readonly hasAccess$: Observable<boolean> = this.userProfileService.getProfile().pipe(
    map(profile => {
      if (!profile) return false;

      if (profile.subscriptionStatus === 'active') {
        return true;
      }

      if (profile.subscriptionStatus === 'trialing' && profile.trialEndsAt) {
        const trialEnd = new Date(profile.trialEndsAt);
        const now = new Date();
        if (now <= trialEnd) {
          return true;
        }
      }

      return false;
    })
  );
}
