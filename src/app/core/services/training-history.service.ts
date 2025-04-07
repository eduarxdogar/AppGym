// src/app/core/services/training-history.service.ts
import { Injectable } from '@angular/core';
import { TrainingSession } from '../../models/training-session.model';

@Injectable({ providedIn: 'root' })
export class TrainingHistoryService {
  private storageKey = 'trainingHistory';

  // Recupera el historial almacenado en LocalStorage
  getHistory(): TrainingSession[] {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  // Agrega una sesión finalizada al historial
  addSession(session: TrainingSession): void {
    const history = this.getHistory();
    history.push(session);
    localStorage.setItem(this.storageKey, JSON.stringify(history));
  }
}
