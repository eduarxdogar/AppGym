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

    const prompt = `Eres un médico deportivo experto en análisis de composición corporal. Analiza este reporte InBody (o composición corporal equivalente) con máxima precisión.

Extrae TODOS los valores numéricos que encuentres. Los reportes pueden provenir de diferentes máquinas (InBody, Biody, etc.). Si un dato como Grasa Visceral o Análisis Segmental NO ESTÁ EXPLÍCITO, devuelve 'null' sin intentar adivinar.

Para la sección "Análisis de Masa Magra Segmental" (Segmental Lean Analysis), extrae el valor de cada segmento en formato "Xkg (Y%)" donde X es el valor en kg y Y es el porcentaje respecto al valor de referencia.

Para la sección "Análisis de Grasa Segmental" (Segmental Fat Analysis), extrae igualmente en formato "Xkg (Y%)".

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "muscleKg": number | null,
  "fatPercent": number | null,
  "bmr": number | null,
  "waterPercentage": number | null,
  "visceralFat": number | null,
  "boneMass": number | null,
  "segmentalMuscle": {
    "rightArm": "3.79kg (115.6%)" | null,
    "leftArm": "3.61kg (111.0%)" | null,
    "trunk": "28.5kg (103.2%)" | null,
    "rightLeg": "9.82kg (106.3%)" | null,
    "leftLeg": "9.55kg (103.4%)" | null
  },
  "segmentalFat": {
    "rightArm": "0.4kg (87.3%)" | null,
    "leftArm": "0.4kg (83.1%)" | null,
    "trunk": "10.2kg (112.5%)" | null,
    "rightLeg": "2.1kg (93.4%)" | null,
    "leftLeg": "2.0kg (91.7%)" | null
  }
}

Instrucciones de extracción:
- muscleKg: Masa Muscular Esquelética (SMM) o Masa Muscular total en Kg.
- fatPercent: Porcentaje de Grasa Corporal (PBF o % Body Fat).
- bmr: Tasa Metabólica Basal (BMR) en kcal.
- waterPercentage: Extrae EXCLUSIVAMENTE el porcentaje (%) de agua o hidratación. NUNCA extraigas los litros (L). Si el reporte dice 'Tasa de hidratación 58.7%', extrae 58.7. Si solo hay litros, calcula: (Litros / Peso) * 100.
- visceralFat: Nivel de Grasa Visceral (1-20).
- boneMass: Masa Ósea en Kg.
- segmentalMuscle: Para cada segmento, combina kg y % en formato "Xkg (Y%)". Si la sección no existe en el reporte, devuelve el objeto con todos los campos en null.
- segmentalFat: Igual que segmentalMuscle pero para la sección de grasa segmental.
- Los segmentos "rightArm"/"leftArm" corresponden a Brazo Derecho/Izquierdo.
- "trunk" corresponde a Tronco/Trunk.
- "rightLeg"/"leftLeg" corresponde a Pierna Derecha/Izquierda.`;

    const textResult = await this.baseAi.generateContent(prompt, true, base64, mimeType);
    const text = this.baseAi.cleanJson(textResult);
    return JSON.parse(text);
  }
}
