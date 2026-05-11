import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Auth, authState, User } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { UserProfile } from '../../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private injector = inject(Injector);

  /** Guarda (crea o actualiza) el perfil del usuario. */
  async saveProfile(profile: UserProfile): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    await setDoc(ref, {
      ...profile,
      updatedAt: new Date().toISOString(),
      createdAt: profile.createdAt || new Date().toISOString()
    }, { merge: true });
  }

  /** Recupera el perfil del usuario actual. Devuelve null si no existe. */
  getProfile(): Observable<UserProfile | null> {
    return authState(this.auth).pipe(
      switchMap((user: User | null) => {
        if (!user) return of(null);
        return runInInjectionContext(this.injector, () => {
          const ref = doc(this.firestore, `users/${user.uid}/profile/data`);
          return from(getDoc(ref)).pipe(
            map(snap => snap.exists() ? snap.data() as UserProfile : null)
          );
        });
      })
    );
  }

  /** Verifica si el perfil existe (para el guard). */
  async profileExists(): Promise<boolean> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    const snap = await getDoc(ref);
    return snap.exists();
  }
}
