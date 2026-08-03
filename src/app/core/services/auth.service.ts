import { Injectable, inject, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, User, signInWithPopup, signOut, onAuthStateChanged, authState, getAdditionalUserInfo } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);

  // Private writable signal initialized as undefined to represent 'loading' state
  private readonly _currentUser = signal<User | null | undefined>(undefined);
  
  // Public readonly signal
  readonly currentUser = this._currentUser.asReadonly();

  // Observable for robust RxJS combinations (avoids sync null on toObservable)
  readonly authState$ = authState(this.auth);

  // Verifies if the authenticated user is the main administrator
  readonly isAdmin$ = this.authState$.pipe(
    map(user => user?.email === environment.adminEmail)
  );

  constructor() {
    // Sync signal with Firebase Auth state
    onAuthStateChanged(this.auth, (user) => {
        this._currentUser.set(user);
        console.log("Auth State Changed:", user ? user.displayName : 'Logged out');
    });
  }

  async loginWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' }); // FORZAR SELECCIÓN DE CUENTA
      const result = await signInWithPopup(this.auth, provider);
      
      const additionalInfo = getAdditionalUserInfo(result);
      if (additionalInfo?.isNewUser && result.user) {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);
        
        const ref = doc(this.firestore, `users/${result.user.uid}/profile/data`);
        await setDoc(ref, {
          subscriptionStatus: 'trialing',
          trialEndsAt: trialEndsAt.toISOString()
        }, { merge: true });
      }

      // onAuthStateChanged will update the signal
      this.router.navigate(['/']); // Redirect to home/dashboard
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/']); // Redirect to home/login
    } catch (error) {
      console.error('Logout Error:', error);
      throw error;
    }
  }
}
