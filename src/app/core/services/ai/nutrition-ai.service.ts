import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { ToastService } from '../toast.service';
import { WeeklyDietPlanSchema, NutritionLabelSchema, WeeklyDietPlan } from '../../../features/nutrition/schemas/nutrition.schema';

@Injectable({
  providedIn: 'root'
})
export class NutritionAiService {
  private readonly baseAi = inject(BaseAiService);
  private readonly toastService = inject(ToastService);

  /**
   * Generates a WeeklyDietPlan using Gemini.
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
${seelegRule ? `${seelegRule}\n` : ''}
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
      const resultText = await this.baseAi.generateContent(prompt, true, undefined, undefined, undefined, useSeelegSupplements);
      const text = this.baseAi.cleanJson(resultText);
      
      const parsedData = JSON.parse(text);
      const validation = WeeklyDietPlanSchema.safeParse(parsedData);
      
      if (!validation.success) {
        console.error('Zod validation failed for WeeklyDietPlan:', validation.error);
        this.toastService.showError('La IA devolvió datos malformados. Por favor, intenta de nuevo.');
        throw new Error('Invalid JSON structure returned by AI');
      }
      
      return validation.data;
    } catch (error: unknown) {
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
      
      const parsedData = JSON.parse(text);
      const validation = NutritionLabelSchema.safeParse(parsedData);
      
      if (!validation.success) {
        console.error('Zod validation failed for Nutrition Label:', validation.error);
        this.toastService.showError('La IA no pudo leer correctamente la etiqueta. Intenta con una foto más clara.');
        throw new Error('Invalid JSON structure from nutrition label scan');
      }
      
      return validation.data;
    } catch (error: unknown) {
      console.error('Error scanning label:', error);
      throw error;
    }
  }
}
