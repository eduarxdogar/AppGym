import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { BoxingRoutine } from '../../models/ai-requests.model';

@Injectable({
  providedIn: 'root'
})
export class BoxingAiService {
  private readonly baseAi = inject(BaseAiService);

  async generateBoxingRoutine(level: string, durationMinutes: number): Promise<BoxingRoutine> {
    if (!this.baseAi.isConfigured) {
      throw new Error('AI Coach no configurado');
    }

    const prompt = `Eres un Entrenador de Boxeo y Acondicionamiento Físico de élite. Genera una rutina de shadow boxing y trabajo de pies.

Sesión solicitada:
- Nivel del atleta: ${level}
- Duración total deseada: ${durationMinutes} minutos

IMPORTANTE: Responde EXCLUSIVAMENTE con un JSON válido con esta estructura exacta:
{
  "title": string,
  "totalDuration": number,
  "warmup": [ string ],
  "rounds": [
    {
      "roundNumber": number,
      "duration": string,
      "instructions": string,
      "focus": "Cardio" | "Technique" | "Power"
    }
  ],
  "cooldown": [ string ]
}`;

    const resultText = await this.baseAi.generateContent(prompt, true);
    const text = this.baseAi.cleanJson(resultText);
    return JSON.parse(text) as BoxingRoutine;
  }
}
