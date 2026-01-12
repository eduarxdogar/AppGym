import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RecoveryMonitorComponent } from '../dashboard/components/recovery-monitor/recovery-monitor.component';

@Component({
  selector: 'app-recovery-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, RecoveryMonitorComponent],
  template: `
    <div class="min-h-screen bg-[#0B0E14] p-4 pb-20">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-6">
        <button (click)="goBack()" class="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1 class="text-2xl font-bold text-white tracking-wider">RECOVERY MONITOR</h1>
      </div>

      <!-- Main Content: The Recovery/Body Map Monitor -->
      <div class="animate-fadeIn">
        <app-recovery-monitor></app-recovery-monitor>
      </div>

      <!-- Tips Section (Optional placeholder) -->
       <div class="mt-8 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h3 class="text-green-400 font-bold mb-2 flex items-center gap-2">
             <mat-icon>lightbulb</mat-icon> Recovery Tips
          </h3>
          <p class="text-zinc-400 text-sm">
             Focus on active recovery for muscles in the "Yellow" zone. 
             "Red" zones require at least 24h more rest.
          </p>
       </div>
    </div>
  `
})
export class RecoveryPageComponent {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
