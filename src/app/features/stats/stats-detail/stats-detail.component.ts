import { Component, OnInit, inject, signal, effect, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, Chart, registerables } from 'chart.js';
import { TrainingHistoryService } from '../../../core/services/training-history.service';
import { StatsData } from '../../../models/stats-data.model';

@Component({
  selector: 'app-stats-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, BaseChartDirective],
  templateUrl: './stats-detail.component.html'
})
export class StatsDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private historyService = inject(TrainingHistoryService);
  private cd = inject(ChangeDetectorRef);

  // Inputs
  type = signal<'volume' | 'workouts' | 'sets' | 'calories'>('volume'); 
  range = signal<'week' | 'month' | 'year' | 'total'>('month');
  
  // Typed ranges for template iteration
  ranges: ('week' | 'month' | 'year' | 'total')[] = ['week', 'month', 'year', 'total'];

  // Data State
  stats = signal<StatsData | null>(null);
  muscleData = signal<ChartData<'radar'> | null>(null);

  // Chart Configs
  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: { tension: 0.4 },
      point: { radius: 4, hoverRadius: 6 }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } }
    },
    plugins: {
      legend: { display: false } // Hide legend for cleaner look
    }
  };
  public lineChartType: ChartType = 'line';

  public radarChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        r: {
            angleLines: { color: 'rgba(255,255,255,0.1)' },
            grid: { color: 'rgba(255,255,255,0.1)' },
            pointLabels: { color: '#9ca3af', font: { size: 10 } },
            ticks: { display: false, backdropColor: 'transparent' }
        }
    },
    plugins: {
        legend: { display: false }
    }
  };
  public radarChartType: ChartType = 'radar';

  constructor() {
      Chart.register(...registerables);
      // React to type or range changes
      effect(() => {
          this.loadStats();
      });
  }

  ngOnInit() {
      // Get type from route
      this.route.paramMap.subscribe(params => {
          const t = params.get('type') as any;
          console.log('Route Param Type:', t); // DEBUG
          if(t) this.type.set(t);
      });

      // Load Muscle Data (Always same)
      this.loadMuscleDistribution();
  }

  loadStats() {
      console.log('Loading Stats for:', this.type()); // DEBUG
      // Update chart options based on type
      if(this.type() === 'calories') {
          this.lineChartOptions = {
              ...this.lineChartOptions,
              scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                  y: { 
                      grid: { color: 'rgba(255,255,255,0.1)' }, 
                      ticks: { color: '#FF6600' },
                      suggestedMin: 0,
                      suggestedMax: 500
                  }
              }
          };
      } else {
           // Reset defaults
           this.lineChartOptions = {
              ...this.lineChartOptions,
              scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                  y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } }
              }
           };
      }

      this.historyService.getStats(this.type(), this.range()).subscribe(data => {
          this.stats.set(data);
          this.cd.detectChanges(); // Force update
      });
  }

  loadMuscleDistribution() {
      this.historyService.getMuscleDistribution().subscribe(data => {
          // Top 6 muscles for radar
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

  get lineChartData(): ChartData<'line'> | undefined {
      const s = this.stats();
      if(!s) return undefined;

      const chartData: ChartData<'line'> = {
          labels: s.chartData.map(d => d.label),
          datasets: [
              {
                  data: s.chartData.map(d => d.value),
                  label: this.getTitle(),
                  backgroundColor: this.type() === 'calories' ? 'rgba(255, 102, 0, 0.1)' : 'rgba(204,255,0,0.1)',
                  borderColor: this.type() === 'calories' ? '#FF6600' : '#CCFF00',
                  pointBackgroundColor: this.type() === 'calories' ? '#FF6600' : '#CCFF00',
                  pointBorderColor: '#fff',
                  pointHoverBackgroundColor: '#fff',
                  pointHoverBorderColor: this.type() === 'calories' ? '#FF6600' : '#CCFF00',
                  fill: 'origin',
              }
          ]
      };
      
      console.log('Chart Data Final:', {
          type: this.type(),
          labels: chartData.labels,
          data: chartData.datasets[0]?.data
      });

      return chartData;
  }

  setRange(r: 'week' | 'month' | 'year' | 'total') {
      this.range.set(r);
  }

  getTitle(): string {
      switch(this.type()) {
          case 'volume': return 'Volumen (kg)';
          case 'workouts': return 'Entrenamientos';
          case 'sets': return 'Series Totales';
          case 'calories': return 'Calorías (kcal)';
          default: return 'Estadísticas';
      }
  }
}
