import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, query, where, orderBy } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Workout } from '../../models/workout.model';
import { WorkoutSession } from '../models/workout-history.model';

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
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  constructor() { }

  getWorkouts(): Observable<Workout[]> {
    return this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) {
          return of([] as Workout[]);
        }
        return runInInjectionContext(this.injector, () => {
             const workoutsCol = collection(this.firestore, 'workouts');
             const q = query(workoutsCol, where('userId', '==', user.uid));
             return (collectionData(q, { idField: 'id' }) as any as Observable<Workout[]>).pipe(
                 catchError(err => {
                     console.error('Firestore rule or collection error:', err);
                     return of([] as Workout[]);
                 })
             );
        });
      }),
      catchError(err => {
        console.error('Auth state error in getWorkouts:', err);
        return of([] as Workout[]);
      })
    );
  }

  private sanitizeData(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeData(item));
    }
    const cleanObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cleanObj[key] = this.sanitizeData(obj[key]);
      }
    }
    return cleanObj;
  }

  async saveWorkout(workout: any): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Debe estar autenticado para guardar.');
    }

    try {
      const workoutsCol = collection(this.firestore, 'workouts');
      const docRef = doc(workoutsCol, String(workout.id));
      const safeWorkout = this.sanitizeData({ ...workout, userId: user.uid });
      await setDoc(docRef, safeWorkout, { merge: true });
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
  
  getHistory(): Observable<WorkoutSession[]> {
    return this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return runInInjectionContext(this.injector, () => {
             const historyCol = collection(this.firestore, 'workout_history');
             const q = query(historyCol, where('userId', '==', user.uid));
             return collectionData(q, { idField: 'id' }) as Observable<WorkoutSession[]>;
        });
      }),
      catchError(err => {
        console.error('Auth state error in getHistory:', err);
        return of([]);
      })
    );
  }

  async saveHistory(session: WorkoutSession): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) throw new Error('User must be authenticated');

    try {
      const historyCol = collection(this.firestore, 'workout_history');
      const docId = session.id ? String(session.id) : doc(historyCol).id;
      const docRef = doc(historyCol, docId);
      
      const safeSession = this.sanitizeData({ ...session, id: docId, userId: user.uid });
      await setDoc(docRef, safeSession, { merge: true });
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
