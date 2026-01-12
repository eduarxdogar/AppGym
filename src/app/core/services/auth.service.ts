import { Injectable, inject, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, User, signInWithPopup, signOut, onAuthStateChanged, user } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  // Private writable signal
  private _currentUser = signal<User | null>(null);
  
  // Public readonly signal
  readonly currentUser = this._currentUser.asReadonly();

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
      await signInWithPopup(this.auth, provider);
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
