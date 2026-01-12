import { Injectable, inject } from '@angular/core';
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
  // private injector = inject(Injector); // Removed as it is no longer needed

  // Create an observable from the currentUser signal to react to login/logout
  private user$ = toObservable(this.authService.currentUser);

  constructor() { }

  getWorkouts(): Observable<any[]> {
    return this.user$.pipe(
      switchMap(user => {
        if (!user) {
          return of([]);
        }
        const workoutsCol = collection(this.firestore, 'workouts');
        const q = query(workoutsCol, where('userId', '==', user.uid));
        return collectionData(q, { idField: 'id' });
      })
    );
  }

  async saveWorkout(workout: any): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Debe estar autenticado para guardar.');
    }

    try {
      const workoutsCol = collection(this.firestore, 'workouts');
      const docRef = doc(workoutsCol, String(workout.id));
      await setDoc(docRef, { ...workout, userId: user.uid }, { merge: true });
    } catch (error) {
      console.error('Error saving workout:', error);
      throw error;
    }
  }

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
  setItem<T>(key: string, value: T): void { }

  /** @deprecated */
  removeItem(key: string): void { }

  /** @deprecated */
  clear(): void { }
}
