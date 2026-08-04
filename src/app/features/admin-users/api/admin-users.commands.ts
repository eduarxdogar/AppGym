import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { AdminUserRow } from '../models/admin-users.models';

@Injectable({ providedIn: 'root' })
export class AdminUsersCommands {
  private readonly firestore = inject(Firestore);

  async hardDeleteAccount(uid: string): Promise<void> {
    const profileRef = doc(this.firestore, `users/${uid}/profile/data`);
    await deleteDoc(profileRef);
    const userRef = doc(this.firestore, `users/${uid}`);
    await deleteDoc(userRef);
  }

  async seedTestData(user: AdminUserRow): Promise<void> {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const weeksAgo = [28, 21, 14, 7];

    const dayNames = ['Día 1 - Pecho/Tríceps', 'Día 2 - Espalda/Bíceps', 'Día 3 - Piernas/Hombros'];

    for (let week = 0; week < 4; week++) {
      const weekStartMs = now - (weeksAgo[week] * ONE_DAY);
      const weightProgression = 50 + (week * 2.5);

      for (let day = 0; day < 3; day++) {
        const workoutDateMs = weekStartMs + (day * ONE_DAY);
        const dateStr = new Date(workoutDateMs).toISOString();
        
        const workoutId = crypto.randomUUID();
        const workoutRef = doc(this.firestore, `users/${user.uid}/workouts/${workoutId}`);
        
        await setDoc(workoutRef, {
          id: workoutId,
          nombre: dayNames[day],
          fecha: dateStr,
          isCompleted: true,
          status: 'completed',
          ejercicios: [
            {
              id: 'ex-press-banca',
              nombre: 'Press de Banca Plano',
              grupoMuscular: 'Pecho',
              series: 3,
              repeticiones: 10,
              pesokg: weightProgression,
              tipos: 'normal'
            },
            {
              id: 'ex-sentadilla',
              nombre: 'Sentadilla Libre',
              grupoMuscular: 'Piernas',
              series: 3,
              repeticiones: 10,
              pesokg: weightProgression + 10,
              tipos: 'normal'
            }
          ],
          exercises: [
             {
                id: 'ex-press-banca',
                nombre: 'Press de Banca Plano',
                sets: [
                  { reps: 10, weight: weightProgression, completed: true },
                  { reps: 10, weight: weightProgression, completed: true },
                  { reps: 10, weight: weightProgression, completed: true }
                ]
             },
             {
                id: 'ex-sentadilla',
                nombre: 'Sentadilla Libre',
                sets: [
                  { reps: 10, weight: weightProgression + 10, completed: true },
                  { reps: 10, weight: weightProgression + 10, completed: true },
                  { reps: 10, weight: weightProgression + 10, completed: true }
                ]
             }
          ]
        });
      }
    }
  }
}
