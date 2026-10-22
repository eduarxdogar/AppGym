import { Injectable, InjectionToken, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Transaction, deleteField, doc, runTransaction } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { CompletedWorkoutSession, WorkoutSession } from '../models/workout-session.model';
import { Workout } from '../models/workout.model';
import { firestoreData, normalizeSession } from '../utils/workout-session.utils';

type TransactionRunner = (operation: (transaction: Transaction) => Promise<WorkoutSession>) => Promise<WorkoutSession>;

/** Injectable SDK boundary so transaction behavior can be tested without production I/O. */
export const WORKOUT_TRANSACTION_RUNNER = new InjectionToken<TransactionRunner>('Workout transaction runner', {
  providedIn: 'root',
  factory: () => {
    const firestore = inject(Firestore);
    return operation => runTransaction(firestore, operation);
  }
});

@Injectable({ providedIn: 'root' })
export class WorkoutCompletionService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly transact = inject(WORKOUT_TRANSACTION_RUNNER);

  async complete(session: CompletedWorkoutSession, plan: readonly Workout[]): Promise<WorkoutSession> {
    const uid = this.auth.currentUser()?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    return this.transact(async transaction => {
      const workoutRef = doc(this.firestore, 'workouts', session.workoutId);
      const workoutSnapshot = await transaction.get(workoutRef);
      if (!workoutSnapshot.exists() || workoutSnapshot.get('userId') !== uid) {
        throw new Error('La rutina no existe o no pertenece al usuario');
      }
      const workout = workoutSnapshot.data() as Workout;
      const completedId = workout.status === 'completed' || workout.isCompleted ? workout.lastSessionId : undefined;
      const historyRef = doc(this.firestore, 'workout_history', completedId ?? session.id);
      const historySnapshot = await transaction.get(historyRef);
      if (historySnapshot.exists()) return normalizeSession(historySnapshot.data() as WorkoutSession);
      if (workout.status === 'completed' || workout.isCompleted) throw new Error('La rutina ya fue finalizada');
      if (workout.activeSessionId && workout.activeSessionId !== session.id) {
        throw new Error('La sesión activa cambió. Recarga la rutina antes de finalizar');
      }

      const scheduled = workout.fecha ? new Date(workout.fecha) : null;
      const finished = new Date(session.endTime);
      scheduled?.setHours(0, 0, 0, 0);
      finished.setHours(0, 0, 0, 0);
      const offset = scheduled && Number.isFinite(scheduled.getTime())
        ? Math.max(0, Math.round((finished.getTime() - scheduled.getTime()) / 86_400_000)) : 0;
      // Read all affected documents before any writes; retries re-evaluate current dates.
      const future = offset > 0 ? await Promise.all(plan.filter(w => w.id !== session.workoutId)
        .map(w => transaction.get(doc(this.firestore, 'workouts', w.id)))) : [];

      const saved: WorkoutSession = firestoreData({ ...session, userId: uid });
      transaction.set(historyRef, saved);
      transaction.update(workoutRef, {
        status: 'completed', isCompleted: true, completedAt: session.endTime,
        durationMinutes: Math.floor(Math.max(0, new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60_000),
        lastSessionId: session.id,
        activeSessionId: deleteField(), activeStartTime: deleteField(), activeSetsState: deleteField()
      });
      for (const snapshot of future) {
        if (!snapshot.exists() || snapshot.get('userId') !== uid) continue;
        const next = snapshot.data() as Workout;
        if (!next.fecha || next.isCompleted || next.status === 'completed') continue;
        const date = new Date(next.fecha);
        const day = new Date(date); day.setHours(0, 0, 0, 0);
        if (!Number.isFinite(date.getTime()) || !scheduled || day <= scheduled) continue;
        date.setDate(date.getDate() + offset);
        transaction.update(snapshot.ref, { fecha: date.toISOString() });
      }
      return saved;
    });
  }
}
