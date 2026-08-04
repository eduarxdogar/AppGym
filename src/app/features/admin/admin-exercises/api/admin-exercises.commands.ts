import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, updateDoc } from '@angular/fire/firestore';
import { AdminExercise } from '../models/admin-exercises.models';

@Injectable({ providedIn: 'root' })
export class AdminExercisesCommands {
  private readonly firestore = inject(Firestore);
  private readonly collectionName = 'global_exercises';

  async createExercise(docId: string, data: Partial<AdminExercise>): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${docId}`);
    await setDoc(ref, data);
  }

  async updateExercise(id: string, data: Partial<AdminExercise>): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(ref, data);
  }
}
