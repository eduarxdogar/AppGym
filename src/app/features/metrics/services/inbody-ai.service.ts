import { Injectable, inject } from '@angular/core';
import { BaseAiService } from '../../../core/services/ai/base-ai.service';

@Injectable({
  providedIn: 'root'
})
export class InbodyAiService {
  private readonly baseAi = inject(BaseAiService);

  async scanInBodyReport(base64: string, mimeType: string): Promise<{
    muscleKg?: number | null;
    fatPercent?: number | null;
    bmr?: number | null;
    waterPercentage?: number | null;
    visceralFat?: number | null;
    boneMass?: number | null;
    segmentalMuscle?: {
      rightArm?: string | null;
      leftArm?: string | null;
      trunk?: string | null;
      rightLeg?: string | null;
      leftLeg?: string | null;
    };
    segmentalFat?: {
      rightArm?: string | null;
      leftArm?: string | null;
      trunk?: string | null;
      rightLeg?: string | null;
      leftLeg?: string | null;
    };
  }> {
    if (!this.baseAi.isConfigured) throw new Error('AI Coach no configurado');

    const prompt = 'Analiza este reporte InBody (o composición corporal equivalente) con máxima precisión y extrae los datos en formato JSON según tus instrucciones del sistema.';

    // Llama a la Cloud Function 'analyzeInbodyAI'
    const textResult = await this.baseAi.callFunction('analyzeInbodyAI', {
      prompt,
      isJson: true,
      imageBase64: base64,
      mimeType: mimeType
    });
    
    const text = this.baseAi.cleanJson(textResult);
    return JSON.parse(text);
  }
}
