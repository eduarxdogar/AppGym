import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { UserProfileService } from '../../core/services/user-profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <!-- Ambient Glow -->
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 h-[300px] w-[300px] bg-[#CCFF00]/10 rounded-full blur-[100px] pointer-events-none"></div>

      <!-- Avatar Section -->
      <div class="relative mb-6">
        <div class="h-32 w-32 rounded-full border-2 border-[#CCFF00] p-1 shadow-[0_0_30px_rgba(204,255,0,0.3)]">
           <img *ngIf="currentUser()?.photoURL; else defaultAvatar" 
                [src]="currentUser()?.photoURL" 
                alt="Profile" 
                class="h-full w-full rounded-full object-cover" />
           <ng-template #defaultAvatar>
              <div class="h-full w-full rounded-full bg-zinc-800 flex items-center justify-center">
                 <mat-icon class="text-6xl text-zinc-500">person</mat-icon>
              </div>
           </ng-template>
        </div>
        <!-- Status Indicator -->
        <div class="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-[#CCFF00] border-4 border-[#0B0E14] flex items-center justify-center">
           <mat-icon class="text-[10px] text-black font-bold">check</mat-icon>
        </div>
      </div>

      <!-- User Info -->
      <h1 class="text-3xl font-bold text-white mb-1 tracking-tight">
         {{ currentUser()?.displayName || 'User' }}
      </h1>
      <p class="text-zinc-500 text-sm mb-8 flex items-center gap-1">
         <mat-icon class="text-xs">mail</mat-icon> {{ currentUser()?.email }}
      </p>

      <!-- Equipment Section -->
      <div class="w-full max-w-sm mb-8">
         <h2 class="text-lg font-bold text-white mb-3">Mi Gimnasio / Equipamiento</h2>
         <p class="text-xs text-zinc-400 mb-4">Selecciona el equipo disponible para filtrar tus ejercicios.</p>
         
         <div class="flex flex-wrap gap-2 mb-6">
            @for (item of availableEquipment; track item) {
               <button (click)="toggleEquipment(item)"
                       class="px-4 py-2 rounded-full text-xs font-bold transition-all border"
                       [ngClass]="selectedEquipment().includes(item) ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_10px_rgba(204,255,0,0.3)]' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-[#CCFF00]'">
                   {{ item }}
               </button>
            }
         </div>

         <button (click)="saveEquipment()" [disabled]="isSaving()"
                 class="w-full py-3 bg-[#CCFF00] hover:bg-[#bce600] text-black font-bold text-sm tracking-widest uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] disabled:opacity-50 flex items-center justify-center gap-2">
            <mat-icon *ngIf="!isSaving()">save</mat-icon>
            <div *ngIf="isSaving()" class="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            {{ isSaving() ? 'Guardando...' : 'Guardar Cambios' }}
         </button>
      </div>

      <!-- Actions -->
      <div class="w-full max-w-xs space-y-4">
         
         <button (click)="logout()" 
                 class="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2">
             <mat-icon>logout</mat-icon> Cerrar Sesión
         </button>

         <button (click)="goBack()" 
                 class="w-full py-3 text-zinc-500 hover:text-white font-medium text-sm transition">
             Volver al Dashboard
         </button>

      </div>

    </div>
  `
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private userProfileState = inject(UserProfileStateService);
  private userProfileService = inject(UserProfileService);

  currentUser = this.authService.currentUser;

  availableEquipment = ['Polea', 'Máquina Smith', 'Máquinas', 'Mancuernas', 'Barra', 'Kettlebells', 'Bandas', 'Calistenia'];
  selectedEquipment = signal<string[]>([]);
  isSaving = signal<boolean>(false);

  constructor() {
    effect(() => {
      const profile = this.userProfileState.profile();
      if (profile && profile.equipment) {
        // Initialize the local signal with the current profile equipment
        this.selectedEquipment.set([...profile.equipment]);
      }
    }, { allowSignalWrites: true });
  }

  toggleEquipment(item: string) {
     const current = this.selectedEquipment();
     if (current.includes(item)) {
        this.selectedEquipment.set(current.filter(eq => eq !== item));
     } else {
        this.selectedEquipment.set([...current, item]);
     }
  }

  async saveEquipment() {
     this.isSaving.set(true);
     try {
        await this.userProfileService.updateEquipment(this.selectedEquipment());
        this.userProfileState.refreshProfile();
     } catch (error) {
        console.error('Error saving equipment:', error);
     } finally {
        this.isSaving.set(false);
     }
  }

  async logout() {
    await this.authService.logout();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
