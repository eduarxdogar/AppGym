import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { WorkoutSession } from '../../models/workout-session.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class TrainingHistoryService {
  private storageService = inject(StorageService);

  // Recupera el historial almacenado en Firestore
  getHistory(): Observable<WorkoutSession[]> {
    return this.storageService.getHistory(); // Returns any[], cast handled by consumer or service
  }

  // Agrega una sesión finalizada al historial
  async addSession(session: WorkoutSession): Promise<void> {
    await this.storageService.saveHistory(session);
  }
}
