import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { WeeklyDietPlan } from '../services/ai-coach.service';

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

  /** Recupera el plan nutricional guardado, o null si no existe. */
  getPlan(): Observable<WeeklyDietPlan | null> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of(null);
    const ref = doc(this.firestore, `nutrition_plans/${uid}`);
    return from(getDoc(ref)).pipe(
      switchMap(snap => {
        if (snap.exists()) {
          return of((snap.data() as any).plan as WeeklyDietPlan);
        }
        return of(null);
      })
    );
  }
}
