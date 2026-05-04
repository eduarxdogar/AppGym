import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, docData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { WeeklyDietPlan } from '../../models/ai-requests.model';

@Injectable({
  providedIn: 'root'
})
export class NutritionService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  /** Guarda (sobrescribe) el plan nutricional del usuario autenticado. */
  async savePlan(plan: WeeklyDietPlan): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    const ref = doc(this.firestore, `nutrition_plans/${uid}`);
    await setDoc(ref, { plan, updatedAt: new Date().toISOString() });
  }

  getPlan(): Observable<WeeklyDietPlan | null> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of(null);
    const ref = doc(this.firestore, `nutrition_plans/${uid}`);
    return docData(ref).pipe(
      map(data => {
        if (data && data['plan']) {
          return data['plan'] as WeeklyDietPlan;
        }
        return null;
      })
    );
  }
}
