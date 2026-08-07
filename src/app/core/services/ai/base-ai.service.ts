import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { ToastService } from '../toast.service';

@Injectable({
  providedIn: 'root'
})
export class BaseAiService {
  private readonly functions = inject(Functions);
  private readonly toastService = inject(ToastService);
  private readonly injector = inject(Injector);
  public readonly activeModel = signal<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  public readonly isConfigured = true;
  private callables: Record<string, any> = {};

  constructor() {
    this.callables['generateWorkoutPlanAI'] = httpsCallable(this.functions, 'generateWorkoutPlanAI', { timeout: 300000 });
  }

  public async callFunction(functionName: string, payload: any): Promise<string> {
    let callable = this.callables[functionName];
    if (!callable) {
      callable = runInInjectionContext(this.injector, () => 
        httpsCallable(this.functions, functionName, { timeout: 300000 })
      );
      this.callables[functionName] = callable;
    }
    try {
      const result = await callable({
        ...payload,
        model: this.activeModel()
      });
      return (result.data as any).text as string;
    } catch (error: any) {
      console.error(`Error in Cloud Function ${functionName}:`, error);
      
      const errorCode = error?.code;
      if (errorCode === 'functions/resource-exhausted') {
        this.toastService.showWarning("El sistema está experimentando alta demanda. Por favor, intenta de nuevo en unos segundos.");
      } else if (errorCode === 'functions/invalid-argument') {
        this.toastService.showError("Error de validación en la IA. Por favor, intenta de nuevo.");
      } else if (errorCode === 'functions/unavailable') {
        this.toastService.showWarning("Nuestro entrenador de IA está descansando, intenta nuevamente.");
      } else {
        this.toastService.showError(error?.message || "Ocurrió un error inesperado de red.");
      }
      
      throw error;
    }
  }

  public cleanJson(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      const firstNewLineIndex = cleaned.indexOf('\n');
      if (firstNewLineIndex !== -1) {
        cleaned = cleaned.substring(firstNewLineIndex + 1);
      } else {
        cleaned = cleaned.substring(3);
        if (cleaned.toLowerCase().startsWith('json')) {
          cleaned = cleaned.substring(4);
        }
      }
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  }
}
