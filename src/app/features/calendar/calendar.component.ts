import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingHistoryService } from '../../core/services/training-history.service';
import { TrainingSession } from '../../models/training-session.model';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  sesiones: TrainingSession[] = [];

  constructor(private historyService: TrainingHistoryService) {}

  ngOnInit(): void {
    this.historyService.getHistory().subscribe({
        next: (data: any[]) => {
            // Map new WorkoutSession to legacy TrainingSession for template compatibility
            this.sesiones = data.map(session => ({
                id: Number(session.id) || Date.now(),
                workoutId: Number(session.workoutId),
                nombre: session.name || session.nombre || 'Entrenamiento',
                fechaInicio: new Date(session.startTime || session.fechaInicio),
                fechaFin: session.endTime ? new Date(session.endTime) : undefined,
                duracion: session.duration,
                pesoTotal: session.totalVolume || session.pesoTotal
            }));
        },
        error: (err) => console.error('Error loading history:', err)
    });
  }
}
