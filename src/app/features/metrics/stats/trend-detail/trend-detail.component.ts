import { Component, OnInit, inject, signal, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, Chart, registerables } from 'chart.js';
import { TrainingHistoryService } from '../../../../core/services/training-history.service';
import { StatsData } from '../../models/stats-data.model';

export type TimeRange = 'week' | 'month' | 'year' | 'total';

@Component({
  selector: 'app-trend-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, BaseChartDirective],
  templateUrl: './trend-detail.component.html'
})
export class TrendDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly historyService = inject(TrainingHistoryService);
  private readonly cd = inject(ChangeDetectorRef);

  // Estado
  type = signal<'volume' | 'workouts' | 'sets' | 'calories'>('volume');
  range = signal<TimeRange>('month');

  ranges: TimeRange[] = ['week', 'month', 'year', 'total'];
  rangeLabels: Record<string, string> = {
    'week': 'Semana',
    'month': 'Mes',
    'year': 'Año',
    'total': 'Todo'
  };

  stats = signal<StatsData | null>(null);

  // Chart config
  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1200, easing: 'easeOutCubic' },
    elements: {
      line: { tension: 0.4 },
      point: { radius: 4, hoverRadius: 6 }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#9ca3af' } }
    },
    plugins: { legend: { display: false } }
  };
  public lineChartType: ChartType = 'line';

  constructor() {
    Chart.register(...registerables);
    effect(() => {
      this.loadStats();
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const t = params.get('type') as any;
      if (t) this.type.set(t);
    });
  }

  loadStats() {
    if (this.type() === 'calories') {
      this.lineChartOptions = {
        ...this.lineChartOptions,
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#9ca3af' } },
          y: {
            grid: { color: 'rgba(255,255,255,0.08)' },
            ticks: { color: '#FF6600' },
            suggestedMin: 0,
            suggestedMax: 500
          }
        }
      };
    } else {
      this.lineChartOptions = {
        ...this.lineChartOptions,
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#9ca3af' } }
        }
      };
    }

    this.historyService.getStats(this.type(), this.range(), 'Todos').subscribe(data => {
      this.stats.set(data);
      this.cd.detectChanges();
    });
  }

  get lineChartData(): ChartData<'line'> | undefined {
    const s = this.stats();
    if (!s) return undefined;
    return {
      labels: s.chartData.map(d => d.label),
      datasets: [{
        data: s.chartData.map(d => d.value),
        label: this.getTitle(),
        backgroundColor: this.type() === 'calories' ? 'rgba(255,102,0,0.1)' : 'rgba(204,255,0,0.1)',
        borderColor: this.type() === 'calories' ? '#FF6600' : '#CCFF00',
        pointBackgroundColor: this.type() === 'calories' ? '#FF6600' : '#CCFF00',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: this.type() === 'calories' ? '#FF6600' : '#CCFF00',
        fill: 'origin',
      }]
    };
  }

  setRange(r: 'week' | 'month' | 'year' | 'total') {
    this.range.set(r);
  }

  getTitle(): string {
    switch (this.type()) {
      case 'volume': return 'Volumen (kg)';
      case 'workouts': return 'Entrenamientos';
      case 'sets': return 'Series Totales';
      case 'calories': return 'Calorías (kcal)';
      default: return 'Tendencia';
    }
  }

  getIcon(): string {
    switch (this.type()) {
      case 'volume': return 'fitness_center';
      case 'workouts': return 'event_note';
      case 'sets': return 'repeat';
      case 'calories': return 'local_fire_department';
      default: return 'bar_chart';
    }
  }

  getAccentColor(): string {
    return this.type() === 'calories' ? '#FF6600' : '#CCFF00';
  }
}
