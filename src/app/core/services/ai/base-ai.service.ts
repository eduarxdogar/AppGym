import { Injectable, signal, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class BaseAiService {
  private readonly functions = inject(Functions);
  public readonly activeModel = signal<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  public readonly isConfigured = true;

  constructor() {}

  public async generateContent(prompt: string, isJson: boolean = true, imageBase64?: string, mimeType?: string, history?: any[], useSeelegSupplements?: boolean): Promise<string> {
    const callGemini = httpsCallable(this.functions, 'callGemini', { timeout: 300000 });
    try {
        const result = await callGemini({
            prompt,
            model: this.activeModel(),
            isJson,
            imageBase64,
            mimeType,
            history,
            useSeelegSupplements
        });
        return (result.data as any).text as string;
    } catch (e: any) {
        console.error("Error callGemini", e);
        throw e;
    }
  }

  public cleanJson(text: string): string {
    return text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
  }
}
