import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';

@Injectable({
  providedIn: 'root'
})
export class InbodyAiService {
  private baseAi = inject(BaseAiService);

  async scanInBodyReport(base64: string, mimeType: string): Promise<{
    muscleKg?: number | null;
    fatPercent?: number | null;
    bmr?: number | null;
    waterPercentage?: number | null;
    visceralFat?: number | null;
    boneMass?: number | null;
  }> {
    if (!this.baseAi.isConfigured) throw new Error('AI Coach no configurado');

    const prompt = `Eres un médico deportivo experto en análisis de composición corporal. Analiza este reporte InBody (o de composición corporal equivalente) con máxima precisión.

Extrae TODOS los valores numéricos que encuentres. Si un valor no está visible en la imagen, devuelve null para ese campo.

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "muscleKg": number | null,
  "fatPercent": number | null,
  "bmr": number | null,
  "waterPercentage": number | null,
  "visceralFat": number | null,
  "boneMass": number | null
}

Instrucciones de extracción:
- muscleKg: Masa Muscular Esquelética (SMM) o Masa Muscular total en Kg.
- fatPercent: Porcentaje de Grasa Corporal (PBF o % Body Fat).
- bmr: Tasa Metabólica Basal (BMR) en kcal.
- waterPercentage: Agua Corporal Total (TBW) en porcentaje o litros. Si es en litros, devuelve el número directamente.
- visceralFat: Nivel de Grasa Visceral (Visceral Fat Level), usualmente un número entero entre 1 y 20.
- boneMass: Masa Ósea (Bone Mass) en Kg, si está disponible.`;

    const textResult = await this.baseAi.generateContent(prompt, true, base64, mimeType);
    const text = this.baseAi.cleanJson(textResult);
    return JSON.parse(text);
  }
}
