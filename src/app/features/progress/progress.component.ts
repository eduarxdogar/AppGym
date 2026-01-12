import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingHistoryService } from '../../core/services/training-history.service';
import { TrainingSession } from '../../models/training-session.model';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './progress.component.html',
})
export class ProgressComponent implements OnInit {
  sesiones: TrainingSession[] = [];
  totalPesoLev: number = 0;

  constructor(private historyService: TrainingHistoryService) {}

  ngOnInit(): void {
    this.historyService.getHistory().subscribe({
        next: (data: any[]) => {
            this.sesiones = data.map(session => ({
                id: Number(session.id) || Date.now(),
                workoutId: Number(session.workoutId),
                nombre: session.name || session.nombre || 'Entrenamiento',
                fechaInicio: new Date(session.startTime || session.fechaInicio),
                fechaFin: session.endTime ? new Date(session.endTime) : undefined,
                duracion: session.duration,
                pesoTotal: session.totalVolume || session.pesoTotal
            }));
            
            this.totalPesoLev = this.sesiones.reduce((total, session) => total + (session.pesoTotal || 0), 0);
        },
        error: (err) => console.error('Error loading progress:', err)
    });
  }
}
