import { Injectable, inject, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { UserProfileStateService } from './user-profile-state.service';
import { TrainingClockService } from './training-clock.service';

/** Posibles estados de suscripción evaluados en tiempo real. */
export type SubscriptionState = 'vip' | 'active' | 'trialing' | 'expired' | 'loading';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private profileState = inject(UserProfileStateService);
  private clock = inject(TrainingClockService);

  /**
   * Máquina de estados computada en tiempo real.
   * - 'loading'  : el perfil aún no ha cargado.
   * - 'active'   : suscripción pagada activa.
   * - 'vip'      : acceso permanente concedido por el servidor.
   * - 'trialing' : dentro del período de prueba de 7 días.
   * - 'expired'  : sin suscripción ni trial válido.
   */
  readonly subscriptionState = computed<SubscriptionState>(() => {
    const profile = this.profileState.profile();

    // undefined = carga inicial aún en progreso
    if (profile === undefined) return 'loading';

    // null = usuario autenticado pero sin perfil creado (o deslogueado)
    if (profile === null || profile.isDeleted) return 'expired';

    // Permanent access is granted only by the server through a protected billing field.
    if (profile.subscriptionStatus === 'vip') return 'vip';

    // Suscripción pagada
    if (profile.subscriptionStatus === 'active' && profile.expiresAt
      && Date.parse(profile.expiresAt) > this.clock.now()) return 'active';

    // Período de prueba vigente
    if (profile.subscriptionStatus === 'trialing' && profile.trialEndsAt) {
      const trialEnd = new Date(profile.trialEndsAt).getTime();
      if (this.clock.now() < trialEnd) return 'trialing';
    }

    // Sin acceso válido
    return 'expired';
  });

  /** Acceso completo para VIP permanente, pago vigente o prueba gratuita. */
  readonly hasAccess = computed<boolean>(() => {
    const state = this.subscriptionState();
    return state === 'vip' || state === 'active' || state === 'trialing';
  });

  readonly isVip = computed(() => ['vip', 'active'].includes(this.subscriptionState()));

  readonly trialDaysRemaining = computed<number | null>(() => {
    if (this.subscriptionState() !== 'trialing') return null;
    const end = Date.parse(this.profileState.profile()!.trialEndsAt!);
    return Math.max(0, Math.ceil((end - this.clock.now()) / 86_400_000));
  });

  /**
   * Observable derivado de la Signal para compatibilidad con Guards RxJS.
   * Emite `true` cuando el estado es 'active' o 'trialing'.
   * El guard espera por separado a la inicialización y al estado cargado.
   */
  readonly hasAccess$: Observable<boolean> = toObservable(this.hasAccess);
}
