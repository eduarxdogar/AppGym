import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, query, where, orderBy, limit } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Workout } from '../../features/workouts/models/workout.model';
import { WorkoutSession } from '../../features/workouts/models/workout-history.model';
import { ChatMessage } from '../../features/workouts/models/ai-requests.model';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly logger = inject(LoggerService);
  private readonly workoutsCol;
  private readonly historyCol;

  constructor() {
    this.workoutsCol = collection(this.firestore, 'workouts');
    this.historyCol = collection(this.firestore, 'workout_history');
  }

  getWorkouts(): Observable<Workout[]> {
    return this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) {
          return of([] as Workout[]);
        }
        return runInInjectionContext(this.injector, () => {
             const q = query(this.workoutsCol, where('userId', '==', user.uid));
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

  private sanitizeData(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeData(item));
    }
    const cleanObj: any = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        cleanObj[key] = this.sanitizeData(obj[key]);
      }
    }
    return cleanObj;
  }

  async saveWorkout(workout: Workout): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Debe estar autenticado para guardar.');
    }

    return runInInjectionContext(this.injector, async () => {
      try {
        const docRef = doc(this.workoutsCol, String(workout.id));
        const safeWorkout = this.sanitizeData({ ...workout, userId: user.uid });
        await setDoc(docRef, safeWorkout, { merge: true });
      } catch (error) {
        this.logger.error('Error saving workout:', error);
        throw error;
      }
    });
  }

  async deleteWorkout(id: string | number): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      try {
        const docRef = doc(this.workoutsCol, String(id));
        await deleteDoc(docRef);
      } catch (error) {
        this.logger.error('Error deleting workout:', error);
        throw error;
      }
    });
  }

  // --- HISTORY MANAGEMENT ---
  
  getHistory(): Observable<WorkoutSession[]> {
    return this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return runInInjectionContext(this.injector, () => {
             const q = query(
               this.historyCol, 
               where('userId', '==', user.uid),
               orderBy('fecha', 'desc'),
               limit(50)
             );
             return collectionData(q, { idField: 'id' }) as Observable<WorkoutSession[]>;
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

    return runInInjectionContext(this.injector, async () => {
      try {
        const docId = session.id ? String(session.id) : doc(this.historyCol).id;
        const docRef = doc(this.historyCol, docId);
        
        const safeSession = this.sanitizeData({ ...session, id: docId, userId: user.uid });
        await setDoc(docRef, safeSession, { merge: true });
      } catch (error) {
        this.logger.error('Error saving history:', error);
        throw error;
      }
    });
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
    return runInInjectionContext(this.injector, async () => {
      const chatCol = collection(this.firestore, 'workouts', workoutId, 'chat_history');
      const docRef = doc(chatCol, message.id);
      await setDoc(docRef, { ...message, userId: user.uid });
    });
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



