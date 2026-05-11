import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';

@Injectable({
  providedIn: 'root'
})
export class InbodyAiService {
  private baseAi = inject(BaseAiService);

  async scanInBodyReport(base64: string, mimeType: string): Promise<{ muscleKg?: number; fatPercent?: number; bmr?: number }> {
    if (!this.baseAi.isConfigured) throw new Error('AI Coach no configurado');

    const prompt = `Analiza este reporte InBody o de composición corporal. Extrae los valores principales.
Devuelve SOLO un JSON con estos campos (usa null si no encuentras el valor):
{ "muscleKg": number | null, "fatPercent": number | null, "bmr": number | null }`;

    const textResult = await this.baseAi.generateContent(prompt, true, base64, mimeType);
    const text = this.baseAi.cleanJson(textResult);
    return JSON.parse(text);
  }
}
