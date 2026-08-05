import { Injectable, inject } from '@angular/core';
import { BaseAiService } from '../../../core/services/ai/base-ai.service';
import { BoxingRoutine } from '../models/ai-requests.model';

@Injectable({
  providedIn: 'root'
})
export class BoxingAiService {
  private readonly baseAi = inject(BaseAiService);

  async generateBoxingRoutine(level: string, durationMinutes: number): Promise<BoxingRoutine> {
    if (!this.baseAi.isConfigured) {
      throw new Error('AI Coach no configurado');
    }

    const prompt = `Sesión solicitada:
- Nivel del atleta: ${level}
- Duración total deseada: ${durationMinutes} minutos`;

    const text = await this.baseAi.callFunction('generateBoxingPlanAI', {
      prompt,
      isJson: true
    });
    
    const cleanJsonText = this.baseAi.cleanJson(text);
    return JSON.parse(cleanJsonText) as BoxingRoutine;
  }
}
