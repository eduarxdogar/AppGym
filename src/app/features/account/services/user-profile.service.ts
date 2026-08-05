import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, updateDoc, getDoc, deleteDoc, collectionGroup, getDocs, query } from '@angular/fire/firestore';
import { Auth, authState, User, signOut } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly injector = inject(Injector);

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
    return runInInjectionContext(this.injector, () => {
      return authState(this.auth).pipe(
        switchMap((user: User | null) => {
          if (!user) return of(null);
          const ref = doc(this.firestore, `users/${user.uid}/profile/data`);
          return from(getDoc(ref)).pipe(
            map(snap => snap.exists() ? snap.data() as UserProfile : null)
          );
        })
      );
    });
  }

  /** Verifica si el perfil existe (para el guard). */
  async profileExists(): Promise<boolean> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    const ref = doc(this.firestore, `users/${uid}/profile/data`);
    const snap = await getDoc(ref);
    return snap.exists();
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
        return { uid, ...snap.data() as UserProfile };
      })
      .filter((p): p is UserProfile & { uid: string } => p !== null);
  }
}

