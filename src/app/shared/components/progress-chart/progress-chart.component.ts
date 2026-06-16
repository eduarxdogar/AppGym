import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TrainingHistoryService } from '../../../core/services/training-history.service';
import { WorkoutSession } from '../../../core/models/workout-history.model';

@Component({
  selector: 'app-progress-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective, MatIconModule],
  providers: [DatePipe],
  template: `
    <div class="w-full flex flex-col gap-4 animate-in fade-in duration-500">
      
      <!-- Controls -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-black text-white uppercase tracking-wider flex items-center">
            <mat-icon class="text-[#CCFF00] drop-shadow-[0_0_6px_rgba(204,255,0,0.4)] mr-2">monitoring</mat-icon> Monitor de Ganancias
          </h2>
          <p class="text-zinc-400 text-xs tracking-widest uppercase mt-1">Sobrecarga Progresiva (Peso Máximo)</p>
        </div>
        
        <div class="relative w-full md:w-64">
          <select [ngModel]="selectedExercise()" (ngModelChange)="selectedExercise.set($event)"
                  class="w-full appearance-none bg-[#151921] border border-zinc-700 hover:border-[#CCFF00] rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#CCFF00] cursor-pointer transition-colors shadow-lg">
            <option value="" disabled selected>Selecciona un ejercicio...</option>
            <option *ngFor="let ex of uniqueExercises()" [value]="ex">{{ ex }}</option>
          </select>
          <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            ▼
          </div>
        </div>
      </div>

      <!-- Chart Container -->
      <div class="relative w-full h-64 md:h-80 bg-[#151921] rounded-2xl p-4 shadow-xl border border-zinc-800">
        
        <div *ngIf="!selectedExercise()" class="absolute inset-0 flex flex-col items-center justify-center text-center z-10 p-6 bg-[#151921]/80 backdrop-blur-sm rounded-2xl">
           <span class="text-4xl mb-4 opacity-50">🏋️‍♂️</span>
           <h3 class="text-white font-bold text-lg mb-1">Sin Ejercicio Seleccionado</h3>
           <p class="text-zinc-500 text-sm">Aún no hay datos para graficar. ¡Ve a entrenar!</p>
        </div>

        <div *ngIf="selectedExercise() && chartData().datasets[0].data.length === 0" class="absolute inset-0 flex flex-col items-center justify-center text-center z-10 p-6 bg-[#151921]/80 backdrop-blur-sm rounded-2xl">
           <span class="text-4xl mb-4 opacity-50">📉</span>
           <h3 class="text-white font-bold text-lg mb-1">Sin Datos Suficientes</h3>
           <p class="text-zinc-500 text-sm">No hay registros de peso para este ejercicio.</p>
        </div>

        <canvas *ngIf="selectedExercise()"
                baseChart
                [data]="chartData()"
                [options]="chartOptions"
                [type]="'line'">
        </canvas>
      </div>

    </div>
  `
})
export class ProgressChartComponent implements OnInit {
  private historyService = inject(TrainingHistoryService);
  private datePipe = inject(DatePipe);

  // State
  private history = signal<WorkoutSession[]>([]);
  selectedExercise = signal<string>('');

  ngOnInit() {
    this.historyService.getHistory().subscribe(data => {
      // Sort history chronologically
      const sorted = [...data].sort((a, b) => {
        const dA = new Date(a.endTime || a.startTime || a.fecha || 0).getTime();
        const dB = new Date(b.endTime || b.startTime || b.fecha || 0).getTime();
        return dA - dB;
      });
      this.history.set(sorted);
      
      // Auto-select first exercise if uniqueExercises is available
      const exercises = this.uniqueExercises();
      if (exercises.length > 0 && !this.selectedExercise()) {
        this.selectedExercise.set(exercises[0]);
      }
    });
  }

  // Computed signal for the dropdown options
  uniqueExercises = computed(() => {
    const sessions = this.history();
    const exercisesSet = new Set<string>();

    sessions.forEach(session => {
      const ejercicios = session.exercises || session.ejercicios || [];
      ejercicios.forEach(ex => {
        const name = ex.name || ex.nombre;
        if (name) {
          // Normaliza el nombre para agrupar (ej: "Sentadilla" == "sentadilla ")
          exercisesSet.add(name.trim());
        }
      });
    });

    return Array.from(exercisesSet).sort();
  });

  // Computed signal to generate Chart Data based on the selected exercise
  chartData = computed<ChartConfiguration['data']>(() => {
    const exerciseName = this.selectedExercise();
    const sessions = this.history();
    
    if (!exerciseName) {
      return { labels: [], datasets: [] };
    }

    const labels: string[] = [];
    const dataPoints: number[] = [];

    sessions.forEach(session => {
      const dateStr = session.endTime || session.startTime || session.fecha;
      if (!dateStr) return;

      const dateObj = new Date(dateStr);
      const formattedDate = this.datePipe.transform(dateObj, 'MMM d') || '';

      const ejercicios = session.exercises || session.ejercicios || [];
      
      // Find all instances of this exercise in the session
      const matchingExs = ejercicios.filter(ex => {
        const name = ex.name || ex.nombre;
        return name && name.trim().toLowerCase() === exerciseName.toLowerCase();
      });

      if (matchingExs.length > 0) {
        let maxWeightForSession = 0;

        matchingExs.forEach(ex => {
          const sets = ex.sets || ex.series || [];
          sets.forEach(set => {
            if (set.completed !== false) {
               const weight = set.weight || set.peso || set.pesokg || 0;
               if (weight > maxWeightForSession) {
                 maxWeightForSession = weight;
               }
            }
          });
        });

        if (maxWeightForSession > 0) {
          labels.push(formattedDate);
          dataPoints.push(maxWeightForSession);
        }
      }
    });

    return {
      labels,
      datasets: [
        {
          data: dataPoints,
          label: 'Peso Máximo (kg)',
          borderColor: '#CCFF00',
          backgroundColor: 'rgba(204, 255, 0, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: '#151921',
          pointBorderColor: '#CCFF00',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4, // Curvas suaves
        }
      ]
    };
  });

  // Chart Configuration
  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Critical for mobile scaling within the relative div
    plugins: {
      legend: {
        display: false // Hide legend for cleaner look
      },
      tooltip: {
        backgroundColor: '#0B0E14',
        titleColor: '#CCFF00',
        bodyColor: '#FFFFFF',
        borderColor: '#3F3F46',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: function(context) {
            return `${context.parsed.y} kg`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false, // Ocultar grilla
        },
        ticks: {
          color: '#A1A1AA', // zinc-400
          font: {
            size: 10,
            family: "'Inter', sans-serif"
          }
        }
      },
      y: {
        grid: {
          color: '#27272A', // zinc-800
          tickLength: 0,
        },
        border: {
          display: false // Ocultar la línea principal del eje Y
        },
        ticks: {
          color: '#A1A1AA',
          font: {
            size: 10,
            family: "'Inter', sans-serif"
          },
          padding: 10,
        },
        beginAtZero: false // Let it auto-scale for better progression visualization
      }
    }
  };
}
