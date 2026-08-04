import { Injectable, inject, signal, DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, query, where } from '@angular/fire/firestore';
import { AuthService } from '../../../core/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface CardioSession {
  id: string;
  userId: string;
  date: string;        // ISO string
  title: string;
  level: string;
  durationMinutes: number;
  caloriesBurned: number;
}

@Injectable({ providedIn: 'root' })
export class CardioSessionService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  private _sessions = signal<CardioSession[]>([]);
  readonly cardioSessions = this._sessions.asReadonly();

  constructor() {
    this.authService.authState$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return runInInjectionContext(this.injector, () => {
          const col = collection(this.firestore, 'cardio_sessions');
          const q = query(col, where('userId', '==', user.uid));
          return collectionData(q, { idField: 'id' }) as any;
        });
      }),
      catchError(err => {
        console.error('[CardioSessionService] Error:', err);
        return of([]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(sessions => this._sessions.set(sessions as CardioSession[]));
  }

  async saveSession(session: Omit<CardioSession, 'id' | 'userId'>): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) throw new Error('Usuario no autenticado');
    const col = collection(this.firestore, 'cardio_sessions');
    const docRef = doc(col);
    await setDoc(docRef, {
      ...session,
      id: docRef.id,
      userId: user.uid
    });
  }
}
