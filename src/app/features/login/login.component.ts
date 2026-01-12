import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, UiCardComponent, MatIconModule],
  template: `
    <div class="min-h-screen w-full bg-background flex items-center justify-center p-4">
        <!-- Background Effects if any, or just plain black -->
        
        <app-ui-card customClass="w-full max-w-md bg-black/40 backdrop-blur-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div class="flex flex-col items-center text-center space-y-8 py-8 px-4">
                
                <!-- Logo GRAVL -->
                <div class="space-y-2">
                    <h1 class="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
                        GRAVL
                    </h1>
                    <p class="text-gray-400 text-sm font-medium tracking-widest uppercase">
                        Tu Entrenador Personal con IA
                    </p>
                </div>

                <!-- Separator or Visual Element -->
                <div class="w-20 h-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>

                <!-- Login Action -->
                <div class="w-full space-y-4">
                     <button 
                        (click)="login()"
                        class="w-full relative group overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-black"
                    >
                        <span class="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity duration-300"></span>
                        <div class="relative bg-black rounded-full px-6 py-4 flex items-center justify-center gap-3 transition-colors group-hover:bg-black/80">
                            <!-- Google Icon SVG -->
                            <svg class="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span class="text-white font-bold text-lg tracking-wide">Continuar con Google</span>
                        </div>
                    </button>
                    
                    <p class="text-xs text-gray-600 mt-6">
                        Al continuar, aceptas nuestros términos y condiciones.
                    </p>
                </div>
            </div>
        </app-ui-card>
    </div>
  `,
  styles: [`
    :host {
        display: block;
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);

  login() {
    this.authService.loginWithGoogle();
  }
}
