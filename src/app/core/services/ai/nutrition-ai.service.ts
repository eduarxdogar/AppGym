import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { ToastService } from '../toast.service';
import { DayDietPlanSchema, WeeklyDietPlanSchema, NutritionLabelSchema, WeeklyDietPlan } from '../../../features/nutrition/schemas/nutrition.schema';

@Injectable({
  providedIn: 'root'
})
export class NutritionAiService {
  private readonly baseAi = inject(BaseAiService);
  private readonly toastService = inject(ToastService);

  /**
   * Generates two bounded daily plans through the server's text provider chain.
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
IMPORTANTE: Responde EXCLUSIVAMENTE con JSON válido para UN día con esta estructura exacta:
{
    "totalCalories": number,
    "macros": { "protein": number, "carbs": number, "fats": number },
    "meals": [
      {
        "name": string,
        "time": string,
        "mainDish": { "item": string, "amount": string, "calories": number, "protein": number, "carbs": number, "fats": number },
        "alternatives": [
          { "item": string, "amount": string, "calories": number, "protein": number, "carbs": number, "fats": number }
        ]
      }
    ]
}

El array alternatives de cada comida debe contener exactamente 3 opciones equivalentes en macros.
Usa nombres y cantidades concisos, sin párrafos. No devuelvas trainingDay/restDay anidados ni el otro día.`;

    try {
      if (!Number.isFinite(targetCalories) || targetCalories <= 0 || !Number.isInteger(profileData.mealsPerDay)
        || profileData.mealsPerDay < 1 || profileData.mealsPerDay > 6) throw new Error('Objetivo nutricional inválido.');
      // Bound output size as well as time: at most two meals per request, with
      // one in-flight request per day. Never expose a partially generated plan.
      const plans = await Promise.all((['trainingDay', 'restDay'] as const).map(async day => {
        const training = day === 'trainingDay';
        const calories = training ? targetCalories : Math.round(targetCalories * 0.825);
        const combined: WeeklyDietPlan['trainingDay'] = { totalCalories: 0, macros: { protein: 0, carbs: 0, fats: 0 }, meals: [] };
        for (let start = 0; start < profileData.mealsPerDay; start += 2) {
          const count = Math.min(2, profileData.mealsPerDay - start);
          const sponsored = training && start === 0 && useSeelegSupplements;
          const portionCalories = Math.round(calories * (start + count) / profileData.mealsPerDay)
            - Math.round(calories * start / profileData.mealsPerDay);
          const dayPrompt = prompt + `\nDÍA SOLICITADO: ${training ? 'entrenamiento' : 'descanso'}. Objetivo total del día: ${calories} kcal.
En ESTA RESPUESTA genera SOLO las comidas ${start + 1} a ${start + count} de ${profileData.mealsPerDay}.
Genera exactamente ${count} comidas; el totalCalories de ESTA PARTE debe ser ${portionCalories} kcal.
Distribuye sus horarios según su posición dentro del día y la ventana de alimentación, sin repetir las otras comidas.
${training ? '' : 'Prioriza proteína y grasas saludables; reduce carbohidratos.'}
${sponsored ? seelegRule + '\nEn la única comida patrocinada añade isSponsored:true y sponsorBrand:"Seeleg".' : 'No incluyas patrocinio ni suplementos de marca.'}`;
          const text = await this.baseAi.generateContent(dayPrompt, true, undefined, undefined, undefined, sponsored);
          const partResult = DayDietPlanSchema.safeParse(JSON.parse(this.baseAi.cleanJson(text)));
          if (!partResult.success) {
            this.toastService.showError('La IA devolvió datos malformados. Por favor, intenta de nuevo.');
            throw new Error('Invalid JSON structure returned by AI');
          }
          const part = partResult.data;
          if (part.meals.length !== count || part.meals.some(meal => meal.alternatives.length !== 3)) {
            throw new Error('La IA devolvió un número de comidas o alternativas inválido.');
          }
          combined.meals.push(...part.meals);
          combined.totalCalories += part.totalCalories;
          for (const macro of ['protein', 'carbs', 'fats'] as const) combined.macros[macro] += part.macros[macro];
        }
        return combined;
      }));
      const parsedData = { trainingDay: plans[0], restDay: plans[1] };
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
