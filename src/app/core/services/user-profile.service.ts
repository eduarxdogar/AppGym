import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, updateDoc, getDoc } from '@angular/fire/firestore';
import { Auth, authState, User } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { UserProfile } from '../../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private injector = inject(Injector);

  /** Guarda (crea o actualiza) el perfil del usuario SIN sobreescribir datos de suscripción. */
  async saveProfile(profile: UserProfile): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    const ref = doc(this.firestore, `users/${uid}/profile/data`);

    // Campos que NUNCA deben ser sobreescritos por el onboarding:
    // subscriptionStatus, trialEndsAt y mpCustomerId son gestionados
    // exclusivamente por AuthService y las Cloud Functions de billing.
    const { subscriptionStatus, trialEndsAt, mpCustomerId, ...profileData } = profile as any;

    const snap = await getDoc(ref);

    if (snap.exists()) {
      // El documento ya existe (fue creado por AuthService al registrarse):
      // Usamos updateDoc para SOLO actualizar los campos del perfil,
      // dejando intactos subscriptionStatus, trialEndsAt, etc.
      await updateDoc(ref, {
        ...profileData,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // El documento NO existe (edge case: onboarding sin registro previo):
      // Inicializamos con el trial de 7 días.
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      await setDoc(ref, {
        ...profileData,
        subscriptionStatus: 'trialing',
        trialEndsAt: trialEnd.toISOString(),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
  }

  /** Actualiza específicamente el equipamiento del usuario. */
  async updateEquipment(equipment: string[]): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    await setDoc(ref, {
      equipment,
      updatedAt: new Date().toISOString()
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
