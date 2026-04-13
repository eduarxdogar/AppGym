import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { UiStateService } from '../../../core/services/ui-state.service';
import { FormsModule } from '@angular/forms';
import { AiCoachService } from '../../../core/services/ai-coach.service';

interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
}

@Component({
  selector: 'app-ai-coach-drawer',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  template: `
    <!-- Overlay for mobile click-to-close -->
    <div *ngIf="uiState.isAiDrawerOpen()" 
         (click)="uiState.closeAiDrawer()"
         class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm lg:hidden animate-in fade-in duration-300">
    </div>

    <!-- Drawer Panel -->
    <div class="fixed top-0 right-0 z-[110] h-full w-full sm:w-96 bg-[#0B0E14] border-l border-zinc-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
         [ngClass]="uiState.isAiDrawerOpen() ? 'translate-x-0' : 'translate-x-full'">
      
      <!-- Header -->
      <div class="px-5 py-4 border-b border-zinc-800 flex justify-between items-center bg-[#151921]">
         <div class="flex items-center gap-3">
             <div class="h-10 w-10 rounded-full bg-[#CCFF00]/10 flex items-center justify-center border border-[#CCFF00]/30 shadow-[0_0_15px_rgba(204,255,0,0.15)]">
                 <mat-icon class="text-[#CCFF00]">smart_toy</mat-icon>
             </div>
             <div>
                 <h2 class="text-white font-bold tracking-wide leading-tight">AI Coach <span class="text-[10px] text-[#CCFF00] font-mono border border-[#CCFF00]/30 px-1 rounded bg-[#CCFF00]/10 ml-1">v2.0</span></h2>
                 <p class="text-[10px] text-zinc-500 uppercase tracking-widest">En línea</p>
             </div>
         </div>
         <button (click)="uiState.closeAiDrawer()" class="text-zinc-500 hover:text-white transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-800">
             <mat-icon>close</mat-icon>
         </button>
      </div>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto p-5 pb-24 space-y-6 scrollbar-hide">
         
         <div *ngFor="let msg of messages" class="flex gap-3" [ngClass]="{'flex-row-reverse': msg.role === 'user'}">
             <div *ngIf="msg.role === 'coach'" class="h-8 w-8 rounded-full bg-[#151921] border border-zinc-700 flex-shrink-0 flex items-center justify-center">
                 <mat-icon class="text-zinc-400 text-sm">smart_toy</mat-icon>
             </div>
             <div class="p-4 rounded-2xl text-sm shadow-md"
                  [ngClass]="msg.role === 'user' ? 'bg-[#CCFF00] text-black rounded-tr-sm' : 'bg-[#151921] border border-zinc-800 text-zinc-300 rounded-tl-sm w-full'">
                 {{ msg.text }}
             </div>
         </div>

         <!-- Loader -->
         <div *ngIf="isLoading" class="flex gap-3">
             <div class="h-8 w-8 rounded-full bg-[#151921] border border-zinc-700 flex-shrink-0 flex items-center justify-center">
                 <mat-icon class="text-zinc-400 text-sm">smart_toy</mat-icon>
             </div>
             <div class="bg-[#151921] border border-zinc-800 p-4 rounded-2xl rounded-tl-sm text-sm text-zinc-300 shadow-md flex items-center gap-2">
                 <div class="h-2 w-2 bg-[#CCFF00] rounded-full animate-bounce"></div>
                 <div class="h-2 w-2 bg-[#CCFF00] rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                 <div class="h-2 w-2 bg-[#CCFF00] rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
             </div>
         </div>

      </div>

      <!-- Input Area -->
      <div class="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14] to-transparent">
          <div class="relative flex items-end">
              <textarea rows="1" 
                        [(ngModel)]="userMessage"
                        (keyup.enter)="sendMessage($event)"
                        class="w-full bg-[#151921] border border-zinc-700 rounded-2xl py-3 pl-4 pr-12 text-sm text-white focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] outline-none resize-none transition-all shadow-lg placeholder:text-zinc-600 disabled:opacity-50"
                        placeholder="Pregúntale al Coach..."
                        [disabled]="isLoading"></textarea>
              <button (click)="sendMessage()" 
                      [disabled]="isLoading"
                      class="absolute right-2 bottom-2 h-8 w-8 rounded-full bg-[#CCFF00] text-black flex items-center justify-center hover:bg-[#bce600] transition-colors shadow-[0_0_10px_rgba(204,255,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">
                  <mat-icon class="text-[18px]">send</mat-icon>
              </button>
          </div>
          <p class="text-[10px] text-zinc-600 text-center mt-2 font-mono">Powered by Gemini AI ✦</p>
      </div>

    </div>
  `
})
export class AiCoachDrawerComponent {
  uiState = inject(UiStateService);
  private aiCoachService = inject(AiCoachService);

  userMessage = '';
  isLoading = false;
  messages: ChatMessage[] = [
    {
      role: 'coach',
      text: '¡Hola! Soy tu AI Coach. Estoy conectado y monitoreando tu progreso. ¿Qué quieres mutar hoy?'
    }
  ];

  async sendMessage(event?: Event) {
    if (event) {
      event.preventDefault(); // Prevent new line on enter
    }

    const txt = this.userMessage.trim();
    if (!txt || this.isLoading) return;

    this.userMessage = '';
    this.messages.push({ role: 'user', text: txt });
    this.isLoading = true;

    try {
      const response = await this.aiCoachService.chatWithCoach(txt);
      this.messages.push({ role: 'coach', text: response });
    } catch (err) {
      this.messages.push({ role: 'coach', text: "Error de conexión con mis circuitos." });
    } finally {
      this.isLoading = false;
    }
  }
}
