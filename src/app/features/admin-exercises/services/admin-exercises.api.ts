import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, setDoc, updateDoc } from '@angular/fire/firestore';

export interface AdminExercise {
  id?: string;
  name: string;
  discipline: string;
  muscleGroup: string;
  type: string;
  difficulty: string;
  instructions: string[];
  equipmentRequired: string[];
  imageUrl: string;
  videoUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminExercisesApi {
  private readonly firestore = inject(Firestore);
  private readonly collectionName = 'global_exercises';

  async getExercises(): Promise<AdminExercise[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as AdminExercise }));
  }

  async createExercise(docId: string, data: Partial<AdminExercise>): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${docId}`);
    await setDoc(ref, data);
  }

  async updateExercise(id: string, data: Partial<AdminExercise>): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(ref, data);
  }
}
