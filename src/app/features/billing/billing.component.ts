import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing.component.html',
})
export class BillingComponent {
  private readonly functions = inject(Functions);
  
  isLoading = signal(false);

  async pay() {
    this.isLoading.set(true);
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
      // Here we could show an error message using a Snackbar or similar
    } finally {
      this.isLoading.set(false);
    }
  }
}
