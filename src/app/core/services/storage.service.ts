import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, query, where, orderBy } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface ChatMessage {
  id: string;
  workoutId: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: string; // ISO string
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private injector = inject(Injector);

  constructor() { }

  getWorkouts(): Observable<any[]> {
    return this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) {
          return of([]);
        }
        // Use runInInjectionContext safely
        return runInInjectionContext(this.injector, () => {
             const workoutsCol = collection(this.firestore, 'workouts');
             const q = query(workoutsCol, where('userId', '==', user.uid));
             return collectionData(q, { idField: 'id' }).pipe(
                 catchError(err => {
                     console.error('Firestore rule or collection error:', err);
                     return of([]);
                 })
             );
        });
      }),
      catchError(err => {
        console.error('Auth state error in getWorkouts:', err);
        return of([]);
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

  // --- HISTORY MANAGEMENT ---
  
  getHistory(): Observable<any[]> {
    return this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return runInInjectionContext(this.injector, () => {
             const historyCol = collection(this.firestore, 'workout_history');
             const q = query(historyCol, where('userId', '==', user.uid));
             return collectionData(q, { idField: 'id' }).pipe(
                 catchError(err => {
                     console.error('Firestore rule or collection error in history:', err);
                     return of([]);
                 })
             );
        });
      }),
      catchError(err => {
        console.error('Auth state error in getHistory:', err);
        return of([]);
      })
    );
  }

  async saveHistory(session: any): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) throw new Error('User must be authenticated');

    try {
      const historyCol = collection(this.firestore, 'workout_history');
      // If session doesn't have ID, create one
      const docId = session.id ? String(session.id) : doc(historyCol).id;
      const docRef = doc(historyCol, docId);
      
      await setDoc(docRef, { ...session, id: docId, userId: user.uid }, { merge: true });
    } catch (error) {
      console.error('Error saving history:', error);
      throw error;
    }
  }

  // --- LEGACY METHODS ---
  getItem<T>(key: string): T | null { return null; }
  setItem<T>(key: string, value: T): void {}
  removeItem(key: string): void {}
  clear(): void {}

  // --- CHAT HISTORY (sub-collection per workout) ---

  async saveChatMessage(workoutId: string, message: ChatMessage): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;
    const chatCol = collection(this.firestore, 'workouts', workoutId, 'chat_history');
    const docRef = doc(chatCol, message.id);
    await setDoc(docRef, { ...message, userId: user.uid });
  }

  getChatHistory(workoutId: string): Observable<ChatMessage[]> {
    return this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return runInInjectionContext(this.injector, () => {
          const chatCol = collection(this.firestore, 'workouts', workoutId, 'chat_history');
          const q = query(chatCol, orderBy('timestamp', 'asc'));
          return collectionData(q, { idField: 'id' }) as Observable<ChatMessage[]>;
        });
      }),
      catchError(() => of([]))
    );
  }
}
