import { Injectable, inject, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { UserProfileStateService } from '../../features/account/services/user-profile-state.service';

/** Posibles estados de suscripción evaluados en tiempo real. */
export type SubscriptionState = 'active' | 'trialing' | 'expired' | 'loading';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly profileState = inject(UserProfileStateService);

  /**
   * Máquina de estados computada en tiempo real.
   * - 'loading'  : el perfil aún no ha cargado.
   * - 'active'   : suscripción pagada activa.
   * - 'trialing' : dentro del período de prueba de 7 días.
   * - 'expired'  : sin suscripción ni trial válido.
   */
  readonly subscriptionState = computed<SubscriptionState>(() => {
    const profile = this.profileState.profile();

    // undefined = carga inicial aún en progreso
    if (profile === undefined) return 'loading';

    // null = usuario autenticado pero sin perfil creado (o deslogueado)
    if (profile === null) return 'expired';

    // Suscripción pagada
    if (profile.subscriptionStatus === 'active') return 'active';

    // Período de prueba vigente
    if (profile.subscriptionStatus === 'trialing' && profile.trialEndsAt) {
      const trialEnd = new Date(profile.trialEndsAt).getTime();
      if (Date.now() <= trialEnd) return 'trialing';
    }

    // Sin acceso válido
    return 'expired';
  });

  /** Signal booleana de acceso rápido (true si 'active' o 'trialing'). */
  readonly hasAccess = computed<boolean>(() => {
    const state = this.subscriptionState();
    return state === 'active' || state === 'trialing';
  });

  /**
   * Observable derivado de la Signal para compatibilidad con Guards RxJS.
   * Emite `true` cuando el estado es 'active' o 'trialing'.
   * Filtra el estado 'loading' para no disparar el guard prematuramente.
   */
  readonly hasAccess$: Observable<boolean> = toObservable(this.hasAccess);
}
