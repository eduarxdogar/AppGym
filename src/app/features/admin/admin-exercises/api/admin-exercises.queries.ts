import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { AdminExercise } from '../models/admin-exercises.models';

@Injectable({ providedIn: 'root' })
export class AdminExercisesQueries {
  private readonly firestore = inject(Firestore);
  private readonly collectionName = 'global_exercises';

  async getExercises(): Promise<AdminExercise[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as AdminExercise }));
  }
}
