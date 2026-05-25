import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, docData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { WeeklyDietPlan } from '../../models/ai-requests.model';

export interface DailyNutritionLog {
  date: string; // YYYY-MM-DD
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFats: number;
  consumedMeals: Record<number, boolean>; // key: meal index (0,1,2...), value: true if consumed
}

@Injectable({
  providedIn: 'root'
})
export class NutritionService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private injector = inject(Injector);

  /** Guarda (sobrescribe) el plan nutricional del usuario autenticado. */
  async savePlan(plan: WeeklyDietPlan): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    const ref = doc(this.firestore, `nutrition_plans/${uid}`);
    await setDoc(ref, { plan, updatedAt: new Date().toISOString() });
  }
  getPlan(): Observable<WeeklyDietPlan | null> {
    return authState(this.auth).pipe(
      switchMap((user: any) => {
        if (!user) return of(null);
        return runInInjectionContext(this.injector, () => {
          const ref = doc(this.firestore, `nutrition_plans/${user.uid}`);
          return docData(ref).pipe(
            map(data => {
              if (data && data['plan']) {
                return data['plan'] as WeeklyDietPlan;
              }
              return null;
            })
          );
        });
      })
    );
  }

  getDailyLog(date: string): Observable<DailyNutritionLog | null> {
    return authState(this.auth).pipe(
      switchMap((user: any) => {
        if (!user) return of(null);
        return runInInjectionContext(this.injector, () => {
          const ref = doc(this.firestore, `users/${user.uid}/nutritionLogs/${date}`);
          return docData(ref) as Observable<DailyNutritionLog | null>;
        });
      })
    );
  }

  async updateDailyLog(date: string, log: DailyNutritionLog): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    const ref = doc(this.firestore, `users/${uid}/nutritionLogs/${date}`);
    await setDoc(ref, log, { merge: true });
  }
}
