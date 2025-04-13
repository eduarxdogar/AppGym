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
    this.sesiones = this.historyService.getHistory();
    this.totalPesoLev = this.sesiones.reduce((total, session) => total + (session.pesoTotal || 0), 0);
  }
}
