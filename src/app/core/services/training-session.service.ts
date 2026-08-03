// src/app/core/services/training-session.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Workout } from '../../core/models/workout.model';
import { TrainingSession } from '../../core/models/training-session.model';



@Injectable({ providedIn: 'root' })
export class TrainingSessionService {
  private readonly session: TrainingSession | null = null;
  private readonly sessionSubject = new BehaviorSubject<TrainingSession | null>(this.loadSession());

  constructor() {}

  private loadSession(): TrainingSession | null {
    const data = localStorage.getItem('currentTrainingSession');
    return data ? JSON.parse(data) : null;
  }

  public saveSession(session: TrainingSession | null) {
    if (session) {
      localStorage.setItem('currentTrainingSession', JSON.stringify(session));
    } else {
      localStorage.removeItem('currentTrainingSession');
    }
    this.sessionSubject.next(session);
  }

  startSession(workout: Workout): void {
    const session: TrainingSession = {
      id: Date.now(),
      workoutId: workout.id,
      nombre: workout.nombre,
      fechaInicio: new Date(),
    };
    this.saveSession(session);
  }

  getSession(): Observable<TrainingSession | null> {
    return this.sessionSubject.asObservable();
  }

  getCurrentSession(): TrainingSession | null {
    return this.sessionSubject.value;
  }
  private convertirDuracion(ms: number): string {
    const segundos = Math.floor(ms / 1000) % 60;
    const minutos = Math.floor(ms / (1000 * 60)) % 60;
    const horas = Math.floor(ms / (1000 * 60 * 60));
    return `${horas}h ${minutos}m ${segundos}s`;
  }

  endSession(): void {
    this.saveSession(null);
  }
  
}

