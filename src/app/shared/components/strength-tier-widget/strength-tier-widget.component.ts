import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GamificationService, GAMIFICATION_RANKS } from '../../../core/services/gamification.service';

@Component({
  selector: 'app-strength-tier-widget',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4 shadow-lg hover:border-zinc-700 transition-colors duration-300">
      
      <!-- Top Section: Icon & Info -->
      <div class="flex items-center gap-4">
        <!-- Shield / Icon Container -->
        <div class="h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0 border border-zinc-800"
             [ngStyle]="{'background-color': state().currentRank.color + '15', 'box-shadow': '0 0 15px ' + state().currentRank.color + '20'}">
          <mat-icon [ngStyle]="{'color': state().currentRank.color}" class="text-3xl" style="height: 32px; width: 32px; font-size: 32px;">
            {{ state().currentRank.icon || 'shield' }}
          </mat-icon>
        </div>
        
        <!-- Text Info -->
        <div class="flex-grow">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-0.5">Rango Actual</h2>
          <div class="flex items-baseline gap-2">
            <h3 class="font-extrabold text-xl uppercase tracking-wider glow-text"
                [ngStyle]="{'color': state().currentRank.color, 'text-shadow': '0 0 10px ' + state().currentRank.color + '80'}">
              {{ state().currentRank.name }}
            </h3>
          </div>
          <p class="text-xs text-slate-400 font-medium mt-0.5">
            Tonelaje Total: <span class="text-white font-bold">{{ state().currentTonnage | number }} kg</span>
          </p>
        </div>
      </div>
      
      <!-- Bottom Section: Progress Bar -->
      <div class="w-full mt-1">
        <div class="h-2.5 w-full bg-zinc-800/80 rounded-full overflow-hidden mb-2 shadow-inner border border-zinc-900">
          <div class="h-full rounded-full transition-all duration-1000 ease-out"
               [ngStyle]="{
                 'width': state().progressPercentage + '%', 
                 'background-color': state().currentRank.color, 
                 'box-shadow': '0 0 12px ' + state().currentRank.color
               }">
          </div>
        </div>
        
        <div class="flex justify-between text-[10px] font-bold tracking-wide text-slate-500 uppercase">
          <span *ngIf="state().nextRankTarget">
            Faltan <span class="text-slate-300">{{ (state().nextRankTarget || 0) - state().currentTonnage | number }} kg</span> para {{ nextRankName() }}
          </span>
          <span *ngIf="!state().nextRankTarget" class="text-[#CCFF00]">
            ¡Máximo nivel alcanzado!
          </span>
          <span>{{ state().progressPercentage }}%</span>
        </div>
      </div>

    </div>
  `
})
export class StrengthTierWidgetComponent {
  private gamificationService = inject(GamificationService);
  
  // Expose the signal
  state = this.gamificationService.gamificationState;

  // Computed to get the name of the next rank
  nextRankName = computed(() => {
    const current = this.state().currentRank.name;
    const index = GAMIFICATION_RANKS.findIndex(r => r.name === current);
    if (index >= 0 && index < GAMIFICATION_RANKS.length - 1) {
      return GAMIFICATION_RANKS[index + 1].name;
    }
    return '';
  });
}
