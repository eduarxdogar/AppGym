import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, query, where, orderBy, writeBatch } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Workout } from '../../core/models/workout.model';
import { WorkoutSession } from '../models/workout-history.model';
import { ChatMessage } from '../models/ai-requests.model';
import { LoggerService } from './logger.service';
import { firestoreData, normalizeSession } from '../utils/workout-session.utils';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly logger = inject(LoggerService);

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
             return (collectionData(q, { idField: 'id' }) as Observable<Workout[]>).pipe(
                 catchError(err => {
                     this.logger.error('Firestore rule or collection error:', err);
                     return of([] as Workout[]);
                 })
             );
        });
      }),
      catchError(err => {
        this.logger.error('Auth state error in getWorkouts:', err);
        return of([] as Workout[]);
      })
    );
  }

  async saveWorkout(workout: Workout): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Debe estar autenticado para guardar.');
    }

    try {
      const workoutsCol = collection(this.firestore, 'workouts');
      const docRef = doc(workoutsCol, String(workout.id));
      const safeWorkout = firestoreData({ ...workout, userId: user.uid });
      await setDoc(docRef, safeWorkout, { merge: true });
    } catch (error) {
      this.logger.error('Error saving workout:', error);
      throw error;
    }
  }

  async deleteWorkout(id: string | number): Promise<void> {
    try {
      const workoutsCol = collection(this.firestore, 'workouts');
      const docRef = doc(workoutsCol, String(id));
      await deleteDoc(docRef);
    } catch (error) {
      this.logger.error('Error deleting workout:', error);
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
             return (collectionData(q, { idField: 'id' }) as Observable<WorkoutSession[]>).pipe(
               map(sessions => sessions.map(normalizeSession))
             );
        });
      }),
      catchError(err => {
        this.logger.error('Auth state error in getHistory:', err);
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
      
      const safeSession = firestoreData({ ...session, id: docId, userId: user.uid });
      await setDoc(docRef, safeSession, { merge: true });
    } catch (error) {
      this.logger.error('Error saving history:', error);
      throw error;
    }
  }

  // --- LEGACY METHODS ---
  getItem<T>(_key: string): T | null { return null; }
  setItem<T>(_key: string, _value: T): void {
    // Legacy stub: no-op in Firestore storage
  }
  removeItem(_key: string): void {
    // Legacy stub: no-op in Firestore storage
  }
  clear(): void {
    // Legacy stub: no-op in Firestore storage
  }

  // --- CHAT HISTORY (sub-collection per workout) ---

  async saveChatMessage(workoutId: string, message: ChatMessage): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;
    const chatCol = collection(this.firestore, 'workouts', workoutId, 'chat_history');
    const docRef = doc(chatCol, message.id);
    await setDoc(docRef, { ...message, userId: user.uid });
  }

  async saveChatMessages(workoutId: string, messages: ChatMessage[]): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) throw new Error('Usuario no autenticado');
    const batch = writeBatch(this.firestore);
    for (const message of messages) {
      batch.set(doc(this.firestore, 'workouts', workoutId, 'chat_history', message.id), { ...message, userId: user.uid });
    }
    await batch.commit();
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



