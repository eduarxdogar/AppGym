import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';
import { MatIconModule } from '@angular/material/icon';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-xs px-4 sm:px-0">
      <div *ngFor="let toast of toastService.toasts()" 
           class="pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md overflow-hidden relative group animate-slideInRight"
           [ngClass]="{
             'bg-[#151921]/90 border-[#CCFF00]/30 text-white': toast.type === 'success',
             'bg-red-950/90 border-red-500/30 text-red-50': toast.type === 'error',
             'bg-zinc-800/90 border-zinc-600/30 text-zinc-200': toast.type === 'info'
           }">
           
        <!-- Left color bar -->
        <div class="absolute left-0 top-0 bottom-0 w-1"
             [ngClass]="{
               'bg-[#CCFF00]': toast.type === 'success',
               'bg-red-500': toast.type === 'error',
               'bg-zinc-500': toast.type === 'info'
             }"></div>
        
        <!-- Icon -->
        <mat-icon [ngClass]="{
            'text-[#CCFF00]': toast.type === 'success',
            'text-red-400': toast.type === 'error',
            'text-zinc-400': toast.type === 'info'
          }">
          {{ getIcon(toast.type) }}
        </mat-icon>

        <!-- Message -->
        <div class="flex-1 text-sm font-medium tracking-wide">
          {{ toast.message }}
        </div>

        <!-- Close Button -->
        <button (click)="toastService.remove(toast.id)" 
                class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-full">
          <mat-icon class="text-[18px] w-[18px] h-[18px]">close</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .animate-slideInRight {
      animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);

  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error_outline';
      case 'info': return 'info';
      default: return 'info';
    }
  }
}
