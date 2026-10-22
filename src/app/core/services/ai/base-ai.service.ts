import { Injectable, InjectionToken, signal, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

export interface AiRequest {
  prompt: string;
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  isJson: boolean;
  imageBase64?: string;
  mimeType?: string;
  history?: unknown[];
  useSeelegSupplements?: boolean;
  purpose?: 'workout';
}
export const AI_REQUEST = new InjectionToken<(data: AiRequest) => Promise<{ data: { text: string } }>>('AI_REQUEST', {
  providedIn: 'root',
  factory: () => httpsCallable<AiRequest, { text: string }>(inject(Functions), 'callGemini', { timeout: 300_000 }),
});

@Injectable({
  providedIn: 'root'
})
export class BaseAiService {
  private readonly request = inject(AI_REQUEST);
  public activeModel = signal<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  public isConfigured = true;

  public generateWorkoutContent(prompt: string): Promise<string> {
    return this.generateContent(prompt, true, undefined, undefined, undefined, undefined, 'workout');
  }

  public async generateContent(prompt: string, isJson: boolean = true, imageBase64?: string, mimeType?: string, history?: unknown[], useSeelegSupplements?: boolean, purpose?: 'workout'): Promise<string> {
    if (imageBase64 && !mimeType) throw new Error('Indica el formato del archivo adjunto.');
    const payload: AiRequest = {
      prompt, model: this.activeModel(), isJson,
      ...(imageBase64 ? { imageBase64, mimeType } : {}),
      ...(history !== undefined ? { history } : {}),
      ...(useSeelegSupplements !== undefined ? { useSeelegSupplements } : {}),
      ...(purpose ? { purpose } : {}),
    };
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.request(payload);
        if (typeof result.data?.text !== 'string' || !result.data.text.trim()) throw new Error('Respuesta de IA vacía');
        return result.data.text;
      } catch (error: unknown) {
        const failure = error as { code?: string; details?: { providerAttemptsComplete?: boolean } } | null;
        // Key rotation lives on the server. Retry transport failure once only;
        // never multiply the three provider attempts or retry permission errors.
        if (attempt > 0 || failure?.code !== 'functions/unavailable' || failure.details?.providerAttemptsComplete) throw error;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  public cleanJson(text: string): string {
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
}
