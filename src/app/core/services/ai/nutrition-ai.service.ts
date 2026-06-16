import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { WeeklyDietPlan } from '../../../models/ai-requests.model';

@Injectable({
  providedIn: 'root'
})
export class NutritionAiService {
  private baseAi = inject(BaseAiService);

  /**
   * Generates a WeeklyDietPlan using Gemini.
   *
   * @param profileData   User profile fields needed for the prompt.
   * @param targetCalories  Daily calorie target (training day).
   * @param useSeelegSupplements  Opt-in flag. When true (set explicitly by
   *   the user), one meal per day is flagged as a Seeleg-sponsored recipe.
   *   Defaults to false — the flag MUST come from the user's saved preference,
   *   never hardcoded or assumed.
   */
  async generateDietPlan(
    profileData: {
      goal: string;
      weight: number;
      mealsPerDay: number;
      fastingProtocol: string;
      firstMealTime: string;
      budgetTier: string;
      rank: string;
    },
    targetCalories: number,
    useSeelegSupplements: boolean = false
  ): Promise<WeeklyDietPlan> {
    if (!this.baseAi.isConfigured) {
      throw new Error('AI Coach no configurado');
    }

    const fastingNote = profileData.fastingProtocol !== 'Sin Ayuno'
      ? `El usuario practica Ayuno Intermitente ${profileData.fastingProtocol}. Su primera comida es a las ${profileData.firstMealTime}. Ajusta la distribución de las comidas para que cuadren EXCLUSIVAMENTE dentro de su ventana de alimentación, consolidando las calorías si es necesario. NO incluyas comidas fuera de esa ventana.`
      : 'El usuario NO practica ayuno intermitente. Distribuye las comidas a lo largo del día de forma balanceada.';

    // ── Sponsored supplement rule ─────────────────────────────────────────────
    // This block is ONLY injected when the user has explicitly opted in.
    let seelegRule = '';
    let mealSchemaExtensions = '';

    if (useSeelegSupplements) {
      seelegRule = `
INTEGRACIÓN SEELEG (activada por el usuario):
El usuario ha optado por recibir recomendaciones de suplementación Seeleg.
Genera exactamente UNA comida (preferiblemente un Snack o Post-Entreno) como
una preparación detallada que utilice suplementos de la marca Seeleg
(ej. "Batido Post-Entreno Seeleg Whey", "Avena con Seeleg Isolate", etc.).
Para ESA comida específica y solo esa, agrega en el JSON los campos:
  "isSponsored": true,
  "sponsorBrand": "Seeleg"
El resto de las comidas NO deben tener esos campos.`;
      
      mealSchemaExtensions = `
        "isSponsored": true, // Opcional, SOLO en la comida patrocinada
        "sponsorBrand": "Seeleg" // Opcional, SOLO en la comida patrocinada`;
    }

    const prompt = `Eres un Nutricionista Deportivo de élite especializado en cronobiología y rendimiento deportivo. Genera un plan de alimentación para ${profileData.goal}.

Datos del usuario:
- Objetivo: ${profileData.goal}
- Peso corporal: ${profileData.weight} kg
- Nivel de Entrenamiento/Rango: ${profileData.rank}
- Calorías objetivo (día de entrenamiento): ${targetCalories} kcal
- Número de comidas dentro de la ventana: ${profileData.mealsPerDay}
- Protocolo de ayuno: ${profileData.fastingProtocol}
- Presupuesto / Supermercado (MUY IMPORTANTE para las sugerencias de alimentos): ${profileData.budgetTier}

INSTRUCCIONES DE AYUNO: ${fastingNote}
${seelegRule}

IMPORTANTE: Responde EXCLUSIVAMENTE con JSON válido con esta estructura exacta (2 planes base):
{
  "trainingDay": {
    "totalCalories": number,
    "macros": { "protein": number, "carbs": number, "fats": number },
    "meals": [
      {
        "name": string,
        "time": string,
        "mainDish": { "item": string, "amount": string, "calories": number, "protein": number, "carbs": number, "fats": number },
        "alternatives": [
          { "item": string, "amount": string, "calories": number, "protein": number, "carbs": number, "fats": number }
        ]${mealSchemaExtensions}
      }
    ]
  },
  "restDay": {
    "totalCalories": number,
    "macros": { "protein": number, "carbs": number, "fats": number },
    "meals": [
      {
        "name": string,
        "time": string,
        "mainDish": { "item": string, "amount": string, "calories": number, "protein": number, "carbs": number, "fats": number },
        "alternatives": [
           { "item": string, "amount": string, "calories": number, "protein": number, "carbs": number, "fats": number }
        ]${mealSchemaExtensions}
      }
    ]
  }
}

NOTA: El día de descanso debe tener ~15-20% menos calorías, priorizando proteína y grasas saludables sobre carbohidratos. El array alternatives de cada comida debe contener exactamente 3 opciones equivalentes en macros.`;

    try {
      const resultText = await this.baseAi.generateContent(prompt, true);
      const text = this.baseAi.cleanJson(resultText);
      return JSON.parse(text) as WeeklyDietPlan;
    } catch (error: any) {
      console.error('Error generating diet plan:', error);
      throw error;
    }
  }

  async scanNutritionLabel(base64: string, mimeType: string): Promise<{ calories: number; protein: number; carbs: number; fats: number }> {
    if (!this.baseAi.isConfigured) throw new Error('AI Coach no configurado');

    const prompt = `Eres un experto en nutrición. Analiza la imagen de esta etiqueta nutricional y extrae los valores por porción (por 100g si no indica porción).
Devuelve SOLO un JSON con estos campos exactos (usa solo números, sin unidades):
{ "calories": number, "protein": number, "carbs": number, "fats": number }`;

    try {
      const textResult = await this.baseAi.generateContent(prompt, true, base64, mimeType);
      const text = this.baseAi.cleanJson(textResult);
      return JSON.parse(text);
    } catch (error: any) {
      console.error('Error scanning label:', error);
      throw error;
    }
  }
}
