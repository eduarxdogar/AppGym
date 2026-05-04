import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';

@Injectable({
  providedIn: 'root'
})
export class InbodyAiService {
  private baseAi = inject(BaseAiService);

  async scanInBodyReport(base64: string, mimeType: string): Promise<{ muscleKg?: number; fatPercent?: number; bmr?: number }> {
    const model = this.baseAi.getModel(true);
    if (!this.baseAi.isConfigured || !model) throw new Error('AI Coach no configurado');

    const prompt = `Analiza este reporte InBody o de composición corporal. Extrae los valores principales.
Devuelve SOLO un JSON con estos campos (usa null si no encuentras el valor):
{ "muscleKg": number | null, "fatPercent": number | null, "bmr": number | null }`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64, mimeType } }
    ]);
    const text = this.baseAi.cleanJson(result.response.text());
    return JSON.parse(text);
  }
}
