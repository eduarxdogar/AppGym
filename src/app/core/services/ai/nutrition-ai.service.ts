import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { WeeklyDietPlan } from '../../../models/ai-requests.model';

@Injectable({
  providedIn: 'root'
})
export class NutritionAiService {
  private baseAi = inject(BaseAiService);

  async generateDietPlan(
    profileData: { goal: string; weight: number; mealsPerDay: number; fastingProtocol: string; firstMealTime: string },
    targetCalories: number
  ): Promise<WeeklyDietPlan> {
    const model = this.baseAi.getModel(true);
    if (!this.baseAi.isConfigured || !model) {
      throw new Error('AI Coach no configurado');
    }

    const fastingNote = profileData.fastingProtocol !== 'Sin Ayuno'
      ? `El usuario practica Ayuno Intermitente ${profileData.fastingProtocol}. Su primera comida es a las ${profileData.firstMealTime}. Ajusta la distribución de las comidas para que cuadren EXCLUSIVAMENTE dentro de su ventana de alimentación, consolidando las calorías si es necesario. NO incluyas comidas fuera de esa ventana.`
      : 'El usuario NO practica ayuno intermitente. Distribuye las comidas a lo largo del día de forma balanceada.';

    const prompt = `Eres un Nutricionista Deportivo de élite especializado en cronobiología y rendimiento deportivo. Genera un plan de alimentación para ${profileData.goal}.

Datos del usuario:
- Objetivo: ${profileData.goal}
- Peso corporal: ${profileData.weight} kg
- Calorías objetivo (día de entrenamiento): ${targetCalories} kcal
- Número de comidas dentro de la ventana: ${profileData.mealsPerDay}
- Protocolo de ayuno: ${profileData.fastingProtocol}

INSTRUCCIONES DE AYUNO: ${fastingNote}

IMPORTANTE: Responde EXCLUSIVAMENTE con JSON válido con esta estructura exacta (2 planes base):
{
  "trainingDay": {
    "totalCalories": number,
    "macros": { "protein": string, "carbs": string, "fats": string },
    "meals": [
      {
        "name": string,
        "time": string,
        "foods": [ { "item": string, "amount": string, "calories": number } ]
      }
    ]
  },
  "restDay": {
    "totalCalories": number,
    "macros": { "protein": string, "carbs": string, "fats": string },
    "meals": [
      {
        "name": string,
        "time": string,
        "foods": [ { "item": string, "amount": string, "calories": number } ]
      }
    ]
  }
}

NOTA: El día de descanso debe tener ~15-20% menos calorías, priorizando proteína y grasas saludables sobre carbohidratos.`;

    const result = await model.generateContent(prompt);
    const text = this.baseAi.cleanJson(result.response.text());
    return JSON.parse(text) as WeeklyDietPlan;
  }

  async scanNutritionLabel(base64: string, mimeType: string): Promise<{ calories: number; protein: number; carbs: number; fats: number }> {
    const model = this.baseAi.getModel(true);
    if (!this.baseAi.isConfigured || !model) throw new Error('AI Coach no configurado');

    const prompt = `Eres un experto en nutrición. Analiza la imagen de esta etiqueta nutricional y extrae los valores por porción (por 100g si no indica porción).
Devuelve SOLO un JSON con estos campos exactos (usa solo números, sin unidades):
{ "calories": number, "protein": number, "carbs": number, "fats": number }`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64, mimeType } }
    ]);
    const text = this.baseAi.cleanJson(result.response.text());
    return JSON.parse(text);
  }
}
