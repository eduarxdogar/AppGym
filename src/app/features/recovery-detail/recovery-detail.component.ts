import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RecoveryMonitorComponent } from '../dashboard/components/recovery-monitor/recovery-monitor.component';

@Component({
  selector: 'app-recovery-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, RecoveryMonitorComponent],
  template: `
    <div class="min-h-screen bg-[#0B0E14] p-4 pb-20 fade-in">
      <!-- Header -->
      <div class="max-w-4xl mx-auto items-center flex gap-4 mb-8 pt-4">
        <button (click)="goBack()" class="h-10 w-10 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700 transition border border-zinc-700">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div>
           <h1 class="text-2xl font-bold text-white tracking-wider uppercase">System Status</h1>
           <p class="text-xs text-zinc-500 tracking-widest">MUSCLE RECOVERY DIAGNOSTIC</p>
        </div>
      </div>

      <!-- Main Content -->
      <div class="max-w-4xl mx-auto">
        <app-recovery-monitor></app-recovery-monitor>
      </div>
       
      <!-- Detailed Legend / Tips -->
      <div class="max-w-4xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
             <div class="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
             <div>
                <span class="text-red-400 font-bold text-xs uppercase block">Critical Fatigue</span>
                <span class="text-zinc-500 text-[10px]">Rest required (24-48h)</span>
             </div>
          </div>
          <div class="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
             <div class="h-3 w-3 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]"></div>
             <div>
                <span class="text-yellow-400 font-bold text-xs uppercase block">Recovering</span>
                <span class="text-zinc-500 text-[10px]">Light activity allowed</span>
             </div>
          </div>
          <div class="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
             <div class="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
             <div>
                <span class="text-green-400 font-bold text-xs uppercase block">Ready</span>
                <span class="text-zinc-500 text-[10px]">Optimal performance</span>
             </div>
          </div>
      </div>
    </div>
  `,
  styles: [`
    .fade-in { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class RecoveryDetailComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
