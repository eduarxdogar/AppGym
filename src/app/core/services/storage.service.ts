import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { toObservable } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private injector = inject(Injector);
  
  // Create an observable from the currentUser signal to react to login/logout
  private user$ = toObservable(this.authService.currentUser);

  constructor() { }

  /**
   * Obtiene los workouts de Firestore filtrados por el usuario autenticado.
   * Retorna un Observable que se actualiza si cambia el usuario.
   */
  getWorkouts(): Observable<any[]> {
    return this.user$.pipe(
      switchMap(user => {
        if (!user) {
          // Si no hay usuario, retornamos array vacío
          return of([]);
        }
        const workoutsCol = collection(this.firestore, 'workouts');
        const q = query(workoutsCol, where('userId', '==', user.uid));
        return runInInjectionContext(this.injector, () => collectionData(q, { idField: 'id' }));
      })
    );
  }

  /**
   * Guarda o actualiza un workout.
   * Usa el ID del workout como ID del documento e incluye el userId real.
   */
  async saveWorkout(workout: any): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Debe estar autenticado para guardar.');
    }

    try {
      const workoutsCol = collection(this.firestore, 'workouts');
      const docRef = doc(workoutsCol, String(workout.id));
      // Guardamos con el userId actual
      await setDoc(docRef, { ...workout, userId: user.uid }, { merge: true });
    } catch (error) {
      console.error('Error saving workout:', error);
      throw error;
    }
  }

  /**
   * Elimina un workout por ID.
   */
  async deleteWorkout(id: string | number): Promise<void> {
    try {
      const workoutsCol = collection(this.firestore, 'workouts');
      const docRef = doc(workoutsCol, String(id));
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting workout:', error);
      throw error;
    }
  }

  // --- Métodos Legacy (LocalStorage) ---
  // Se mantienen vacíos para evitar errores de compilación
  
  /** @deprecated */
  getItem<T>(key: string): T | null { return null; }

  /** @deprecated */
  setItem<T>(key: string, value: T): void {}

  /** @deprecated */
  removeItem(key: string): void {}

  /** @deprecated */
  clear(): void {}
}
