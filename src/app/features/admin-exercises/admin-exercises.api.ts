import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, setDoc, updateDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class AdminExercisesApi {
  private firestore = inject(Firestore);
  private readonly collectionName = 'global_exercises';

  async getExercises(): Promise<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createExercise(docId: string, data: any): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${docId}`);
    await setDoc(ref, data);
  }

  async updateExercise(id: string, data: any): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(ref, data);
  }
}
