import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private firestore = inject(Firestore);
  private readonly TEMP_USER_ID = 'usuario-dev-001';

  constructor() { }

  /**
   * Obtiene los workouts de Firestore.
   * Retorna un Observable con el array de datos.
   */
  getWorkouts(): Observable<any[]> {
    const workoutsCol = collection(this.firestore, 'workouts');
    const q = query(workoutsCol, where('userId', '==', this.TEMP_USER_ID));
    return collectionData(q, { idField: 'id' });
  }

  /**
   * Guarda o actualiza un workout.
   * Usa el ID del workout como ID del documento.
   */
  async saveWorkout(workout: any): Promise<void> {
    try {
      const workoutsCol = collection(this.firestore, 'workouts');
      const docRef = doc(workoutsCol, String(workout.id));
      await setDoc(docRef, { ...workout, userId: this.TEMP_USER_ID }, { merge: true });
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
  // Se mantienen vacíos para evitar errores de compilación en otros componentes
  // que aún no se hayan migrado completamente o por seguridad.

  /** @deprecated */
  getItem<T>(key: string): T | null {
    return null;
  }

  /** @deprecated */
  setItem<T>(key: string, value: T): void {
  }

  /** @deprecated */
  removeItem(key: string): void {
  }

  /** @deprecated */
  clear(): void {
  }
}
