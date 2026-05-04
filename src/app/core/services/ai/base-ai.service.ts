import { Injectable, signal, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class BaseAiService {
  private functions = inject(Functions);
  public activeModel = signal<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  public isConfigured = true;

  constructor() {}

  public async generateContent(prompt: string, isJson: boolean = true, imageBase64?: string, mimeType?: string, history?: any[]): Promise<string> {
    const callGemini = httpsCallable(this.functions, 'callGemini');
    try {
        const result = await callGemini({
            prompt,
            model: this.activeModel(),
            isJson,
            imageBase64,
            mimeType,
            history
        });
        return (result.data as any).text as string;
    } catch (e: any) {
        console.error("Error callGemini", e);
        throw e;
    }
  }

  public cleanJson(text: string): string {
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
}
