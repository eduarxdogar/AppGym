import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, Chart, registerables } from 'chart.js';
import { TrainingHistoryService } from '../../../core/services/training-history.service';
import { ProgressChartComponent } from '../../../shared/components/progress-chart/progress-chart.component';

@Component({
  selector: 'app-stats-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, BaseChartDirective, ProgressChartComponent],
  templateUrl: './stats-detail.component.html'
})
export class StatsDetailComponent implements OnInit {
  private historyService = inject(TrainingHistoryService);
  private cd = inject(ChangeDetectorRef);

  // Radar data
  muscleData = signal<ChartData<'radar'> | null>(null);

  // Métricas globales para las tarjetas de navegación
  metrics = signal<{
    workoutsCount: number;
    totalVolume: number;
    estimatedCalories: number;
    totalSets: number;
  }>({
    workoutsCount: 0,
    totalVolume: 0,
    estimatedCalories: 0,
    totalSets: 0
  });

  public radarChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1500, easing: 'easeOutQuart' },
    scales: {
      r: {
        angleLines: { color: 'rgba(255,255,255,0.1)' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        pointLabels: { color: '#9ca3af', font: { size: 10 } },
        ticks: { display: false, backdropColor: 'transparent' }
      }
    },
    plugins: { legend: { display: false } }
  };
  public radarChartType: ChartType = 'radar';

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() {
    this.loadMuscleDistribution();
    this.loadGlobalMetrics();
  }

  loadGlobalMetrics() {
    // Load total stats (all-time) for the nav cards
    this.historyService.getStats('volume', 'total', 'Todos').subscribe(vol => {
      this.historyService.getStats('workouts', 'total', 'Todos').subscribe(wrk => {
        this.historyService.getStats('calories', 'total', 'Todos').subscribe(cal => {
          this.historyService.getStats('sets', 'total', 'Todos').subscribe(sets => {
            this.metrics.set({
              workoutsCount: wrk.count,
              totalVolume: vol.total,
              estimatedCalories: cal.total,
              totalSets: sets.total
            });
            this.cd.detectChanges();
          });
        });
      });
    });
  }

  loadMuscleDistribution() {
    this.historyService.getMuscleDistribution().subscribe(data => {
      const top = data.slice(0, 8);
      this.muscleData.set({
        labels: top.map(d => d.label),
        datasets: [{
          data: top.map(d => d.value),
          label: 'Frecuencia',
          backgroundColor: 'rgba(204, 255, 0, 0.2)',
          borderColor: '#CCFF00',
          pointBackgroundColor: '#CCFF00',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#CCFF00'
        }]
      });
    });
  }
}
