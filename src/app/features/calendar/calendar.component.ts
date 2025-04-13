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
    this.sesiones = this.historyService.getHistory();
  }
}
