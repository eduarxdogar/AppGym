import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, getDoc, deleteDoc, collectionGroup, getDocs, query } from '@angular/fire/firestore';
import { Auth, authState, User, signOut } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { UserProfile } from '../../core/models/user-profile.model';
import { isOnboardingComplete } from '../models/onboarding.validation';
import { profileEquipment } from '../models/equipment';

/** Profiles contain JSON data; remove absent optional fields recursively before writing. */
export function profileWriteData(profile: UserProfile): Record<string, unknown> {
  const { subscriptionStatus, trialEndsAt, expiresAt, mpCustomerId,
    subscriptionPaymentId, subscriptionPaymentUpdatedAt, subscriptionPaymentApprovedAt, ...data } = profile;
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.filter(item => item !== undefined).map(clean);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)]));
    }
    return value;
  };
  return clean(data) as Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly injector = inject(Injector);

  /** Guarda (crea o actualiza) el perfil del usuario SIN sobreescribir datos de suscripción. */
  async saveProfile(profile: UserProfile): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    if (profile.onboardingCompleted === true && !isOnboardingComplete(profile)) {
      throw new Error('Completa un peso válido, objetivo, nivel y al menos un día disponible.');
    }
    const ref = doc(this.firestore, `users/${uid}/profile/data`);

    const availableEquipment = profileEquipment(profile);
    await setDoc(ref, { ...profileWriteData(profile), availableEquipment,
      equipment: availableEquipment.includes('BODYWEIGHT') ? ['Calistenia'] : availableEquipment,
      updatedAt: new Date().toISOString() }, { merge: true });
  }

  /** Actualiza específicamente el equipamiento del usuario. */
  async updateEquipment(equipment: string[]): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    const snapshot = await getDoc(ref);
    const availableEquipment = profileEquipment({ baseGym: snapshot.data()?.['baseGym'], equipment });
    await setDoc(ref, {
      equipment: availableEquipment.includes('BODYWEIGHT') ? ['Calistenia'] : availableEquipment,
      availableEquipment,
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
          return docData(ref).pipe(map(data => data ? data as UserProfile : null));
        });
      })
    );
  }

  /** A billing-only or legacy profile is not a completed onboarding. */
  async hasCompletedOnboarding(): Promise<boolean> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    const snap = await getDoc(ref);
    return snap.exists() && isOnboardingComplete(snap.data());
  }

  /**
   * SOFT DELETE (Cliente): Marca el perfil como eliminado en Firestore
   * sin borrar el documento. Luego cierra la sesión del usuario.
   * @param uid UID del usuario a eliminar lógicamente.
   */
  async softDeleteAccount(uid: string): Promise<void> {
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    await updateDoc(ref, {
      isDeleted: true,
      deletedAt: Date.now(),
      updatedAt: new Date().toISOString(),
    });
    // Expulsar al usuario de la sesión inmediatamente
    await signOut(this.auth);
  }

  /**
   * HARD DELETE (Super Admin): Elimina físicamente el documento raíz
   * del usuario en Firestore. Las subcolecciones deben limpiarse
   * mediante una Cloud Function (pendiente de integrar).
   * @param uid UID del usuario a eliminar permanentemente.
   */
  async hardDeleteAccount(uid: string): Promise<void> {
    // Eliminar documento de perfil
    const profileRef = doc(this.firestore, `users/${uid}/profile/data`);
    await deleteDoc(profileRef);
    // Eliminar documento raíz del usuario
    const userRef = doc(this.firestore, `users/${uid}`);
    await deleteDoc(userRef);
  }

  /**
   * Recupera TODOS los perfiles de usuario (solo para Super Admin).
   *
   * Usa `collectionGroup('profile')` para consultar en una sola operación
   * todos los documentos de la subcoleccion 'profile' sin importar el UID.
   * La jerarquía en Firestore es: users/{uid}/profile/data
   *   - snap.ref           → referencia a 'data'
   *   - snap.ref.parent    → referencia a la subcoleccion 'profile'
   *   - snap.ref.parent.parent → referencia al documento 'users/{uid}'
   */
  async getAllProfiles(): Promise<(UserProfile & { uid: string })[]> {
    const profilesQuery = query(collectionGroup(this.firestore, 'profile'));
    const querySnapshot = await getDocs(profilesQuery);

    return querySnapshot.docs
      .map(snap => {
        // Extraemos el UID del documento padre (users/{uid})
        const uid = snap.ref.parent.parent?.id;
        if (!uid) return null; // seguridad: descartamos docs huérfanos
        return { ...snap.data() as UserProfile, uid };
      })
      .filter((p): p is UserProfile & { uid: string } => p !== null);
  }
}

