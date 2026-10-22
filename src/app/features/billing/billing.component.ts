import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SubscriptionService } from '../../core/services/subscription.service';

import { Functions, httpsCallable } from '@angular/fire/functions';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [],
  templateUrl: './billing.component.html',
})
export class BillingComponent {
  private readonly functions = inject(Functions);
  private readonly router = inject(Router);
  readonly subscription = inject(SubscriptionService);
  readonly errorMessage = signal('');
  
  isLoading = signal(false);

  constructor() {
    effect(() => {
      if (this.subscription.hasAccess()) void this.router.navigate(['/dashboard'], { replaceUrl: true });
    });
  }

  async pay() {
    if (this.subscription.subscriptionState() !== 'expired') return;
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const checkout = httpsCallable<{ }, { init_point: string }>(this.functions, 'createCheckoutSession');
      const result = await checkout();
      
      if (result.data?.init_point) {
        globalThis.location.href = result.data.init_point;
      } else {
        throw new Error('No se recibió init_point desde el servidor');
      }
    } catch (error) {
      console.error('Error al generar la sesión de pago:', error);
      this.errorMessage.set('No pudimos abrir el pago. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
