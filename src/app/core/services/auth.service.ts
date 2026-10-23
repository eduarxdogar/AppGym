import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, User, signInWithPopup, signOut, onAuthStateChanged, authState, user as authUser } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Router } from '@angular/router';
import { shareReplay, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { UserProfileStateService } from './user-profile-state.service';
import { adminAccessForUser } from './admin-access';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly functions = inject(Functions);
  private readonly logger = inject(LoggerService);
  private readonly profileState = inject(UserProfileStateService);
  private readonly destroyRef = inject(DestroyRef);
  private billingInitialization?: { uid: string; promise: Promise<void> };

  // Private writable signal initialized as undefined to represent 'loading' state
  private readonly _currentUser = signal<User | null | undefined>(undefined);
  
  // Public readonly signal
  readonly currentUser = this._currentUser.asReadonly();

  // Observable for robust RxJS combinations (avoids sync null on toObservable)
  readonly authState$ = authState(this.auth);

  // Re-evaluate signed claims on login and ID-token refresh; share the result with guards and menus.
  readonly isAdmin$ = authUser(this.auth).pipe(
    switchMap(user => adminAccessForUser(user, environment.adminEmail)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
    // Sync signal with Firebase Auth state
    const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        this._currentUser.set(user);
        if (user) {
          void this.ensureSubscriptionInitialized().catch(error =>
            this.logger.error('Subscription initialization failed:', error));
        } else {
          this.billingInitialization = undefined;
        }
        this.logger.log("Auth State Changed:", user ? user.displayName : 'Logged out');
    });
    this.destroyRef.onDestroy(unsubscribe);
  }

  /** One request per signed-in session, shared by login and route guards. */
  ensureSubscriptionInitialized(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return Promise.resolve();
    if (this.billingInitialization?.uid === uid) return this.billingInitialization.promise;
    const promise = Promise.resolve().then(async () => {
      await httpsCallable(this.functions, 'initializeSubscription')({});
      if (this.auth.currentUser?.uid === uid) this.profileState.refreshProfile();
    }).catch(error => {
      if (this.billingInitialization?.promise === promise) this.billingInitialization = undefined;
      throw error;
    });
    this.billingInitialization = { uid, promise };
    return promise;
  }

  async loginWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' }); // FORZAR SELECCIÓN DE CUENTA
      await signInWithPopup(this.auth, provider);
      await this.ensureSubscriptionInitialized();
    } catch (error) {
      this.logger.error('Google Sign-In Error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/']); // Redirect to home/login
    } catch (error) {
      this.logger.error('Logout Error:', error);
      throw error;
    }
  }
}
