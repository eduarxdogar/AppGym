import { Injectable, signal } from '@angular/core';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerativeModel } from '@google/generative-ai';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BaseAiService {
  private genAI: GoogleGenerativeAI | null = null;
  public activeModel = signal<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  public isConfigured = false;

  constructor() { 
    const key = environment.geminiApiKey;
    
    if (!key || key.includes('PEGAR_AQUI') || key === '') {
        console.warn("⚠️ Falta configurar la API Key de Gemini en environment.ts. AI Coach desactivado.");
        this.isConfigured = false;
        return;
    }

    this.isConfigured = true;
    this.genAI = new GoogleGenerativeAI(environment.geminiApiKey);
  }

  public getModel(isJson: boolean = true): GenerativeModel | null {
     if (!this.genAI) return null;
     return this.genAI.getGenerativeModel({ 
        model: this.activeModel(),
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
     });
  }

  public cleanJson(text: string): string {
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
}
