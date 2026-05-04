import { Injectable, inject } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { UserProfileStateService } from '../user-profile-state.service';
import { WorkoutService } from '../workout.service';
import { MetricsService } from '../metrics.service';
import { CardioSessionService } from '../cardio-session.service';

@Injectable({
  providedIn: 'root'
})
export class ChatAiService {
  private baseAi = inject(BaseAiService);
  private profileState = inject(UserProfileStateService);
  private workoutService = inject(WorkoutService);
  private metricsService = inject(MetricsService);
  private cardioService = inject(CardioSessionService);
  
  private chatHistory: any[] = [];

  resetChat() {
     this.chatHistory = [];
  }

  async chatWithCoach(message: string, imageBase64?: string, mimeType?: string): Promise<string> {
    if (!this.baseAi.isConfigured) {
        return "El AI Coach no está configurado. Por favor provee la API Key.";
    }

    try {
        if (this.chatHistory.length === 0) {
            const metrics = this.metricsService.weeklyMetrics();
            const userProfile = this.profileState.profile();
            
            const contextText = `Eres 'Tríada Coach', un entrenador personal de élite. Tu tono debe ser conciso, directo, motivador (estilo 'bro de gimnasio inteligente') y coloquial. NUNCA respondas con ensayos largos o viñetas excesivas. Usa respuestas cortas y al grano.
Tu base de conocimiento es EXCLUSIVAMENTE el historial y estado que te proporciono. NO inventes fechas, NO asumas entrenamientos que no están detallados aquí.
Si el usuario pregunta por 'tonelaje', debes sumar (Series x Repeticiones x Peso) de los ejercicios del día indicado, pero entrégale solo el número final o un resumen muy breve. Si pregunta por fatiga o qué hacer después, da 1 o 2 recomendaciones rápidas.
No uses títulos grandes (##) a menos que sea estrictamente necesario. Usa negritas para resaltar números importantes. Compórtate como en un chat de WhatsApp con un atleta avanzado.

PERFIL BIOMÉTRICO: Peso=${userProfile?.weight}kg, Altura=${userProfile?.height}cm, Nivel=${userProfile?.fitnessLevel}, Objetivo=${userProfile?.goal}
InBody: Músculo=${userProfile?.inbodyData?.muscleKg || 'N/A'}kg, Grasa=${userProfile?.inbodyData?.fatPercent || 'N/A'}%
Rutinas activas: ${JSON.stringify(this.workoutService.workouts())}
Sesiones cardio (7d): ${JSON.stringify(this.cardioService.cardioSessions())}
Métricas semanales calculadas: Sesiones=${metrics.workoutsCount}, Tonelaje=${metrics.totalVolume}kg, Series=${metrics.totalSets}, Calorías estimadas=${metrics.estimatedCalories}kcal. Usa estos datos cuando el usuario pregunte por su progreso semanal. NO los recalcules manualmente.`;

            this.chatHistory.push({ role: "user", parts: [{ text: contextText }] });
            this.chatHistory.push({ role: "model", parts: [{ text: "¡Entendido! Soy Tríada Coach. Vamos a darle, dime qué necesitas de tu plan." }] });
        }
        
        let promptText = message || "¿Qué ves en esta imagen?";
        this.chatHistory.push({ role: "user", parts: [{ text: promptText }] });
        
        const responseText = await this.baseAi.generateContent(
            promptText, 
            false, 
            imageBase64, 
            mimeType, 
            // We pass a copy without the last user message, since prompt is sent separately
            this.chatHistory.slice(0, this.chatHistory.length - 1)
        );
        
        this.chatHistory.push({ role: "model", parts: [{ text: responseText }] });
        return responseText;
    } catch (err) {
        console.error('Error al chatear con Coach:', err);
        return "Mi red neuronal falló, repite eso soldad@.";
    }
  }
}
