import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { UserProfile } from '../../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

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
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of(null);
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    return from(getDoc(ref)).pipe(
      switchMap(snap => snap.exists()
        ? of(snap.data() as UserProfile)
        : of(null)
      )
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
