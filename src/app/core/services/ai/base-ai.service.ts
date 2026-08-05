import { Injectable, signal, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class BaseAiService {
  private readonly functions = inject(Functions);
  public readonly activeModel = signal<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  public readonly isConfigured = true;

  private readonly callGeminiCallable: any;

  constructor() {
    this.callGeminiCallable = httpsCallable(this.functions, 'callGemini', { timeout: 300000 });
  }

  public async generateContent(prompt: string, isJson: boolean = true, imageBase64?: string, mimeType?: string, history?: any[], useSeelegSupplements?: boolean): Promise<string> {
    try {
        const result = await this.callGeminiCallable({
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
