import { Injectable, inject, signal } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { UserProfileStateService } from '../../../features/account/services/user-profile-state.service';
import { WorkoutService } from '../../../features/workouts/services/workout.service';
import { MetricsService } from '../../../features/metrics/services/metrics.service';
import { CardioSessionService } from '../../../features/cardio/services/cardio-session.service';
import { StorageService } from '../storage.service';
import { ChatMessage } from '../../../features/workouts/models/ai-requests.model';
import { ExerciseImageService } from '../../../features/workouts/services/exercise-image.service';
import { RecoveryService } from '../../../features/metrics/services/recovery.service';
import { Workout } from '../../../features/workouts/models/workout.model';

@Injectable({
  providedIn: 'root'
})
export class ChatAiService {
  private readonly baseAi         = inject(BaseAiService);
  private readonly profileState    = inject(UserProfileStateService);
  private readonly workoutService  = inject(WorkoutService);
  private readonly metricsService  = inject(MetricsService);
  private readonly cardioService   = inject(CardioSessionService);
  private readonly storageService  = inject(StorageService);
  private readonly imgService      = inject(ExerciseImageService);
  private readonly recoveryService = inject(RecoveryService);

  /** Currently active workout context for the coach */
  private readonly activeWorkoutId = signal<string | null>(null);
  private chatHistory: { role: string; parts: { text: string }[] }[] = [];

  /** Persisted messages loaded from Firestore */
  readonly messages = signal<ChatMessage[]>([]);

  resetChat() {
    this.chatHistory = [];
    this.messages.set([]);
    this.activeWorkoutId.set(null);
  }

  /** Call this when entering a workout execution view */
  setActiveWorkout(workoutId: string) {
    if (this.activeWorkoutId() === workoutId) return;
    this.activeWorkoutId.set(workoutId);
    this.chatHistory = [];          // Reset history to re-inject new context
    this.loadChatHistory(workoutId);
  }

  loadChatHistory(workoutId: string) {
    if (!workoutId) return;
    this.storageService.getChatHistory(workoutId).subscribe({
      next: (msgs) => {
        this.messages.set(msgs || []);
        if (msgs && msgs.length > 0) {
          this.chatHistory = msgs.map(m => ({
            role: m.role === 'coach' ? 'model' : 'user',
            parts: [{ text: m.text }]
          }));
        } else {
          this.chatHistory = [];
        }
      },
      error: (err) => {
        console.error('Error loading chat history:', err);
        this.messages.set([]);
        this.chatHistory = [];
      }
    });
  }

  async chatWithCoach(
    message: string,
    imageBase64?: string,
    mimeType?: string,
    targetWorkoutId?: string
  ): Promise<string> {
    if (!this.baseAi.isConfigured) {
      return 'El AI Coach no está configurado. Por favor provee la API Key.';
    }

    const workoutId = targetWorkoutId ?? this.activeWorkoutId();

    try {
      // --- Inject context on first turn ---
      if (this.chatHistory.length === 0) {
        const contextText = this.buildInitialContext(workoutId);

        this.chatHistory.push(
            { role: 'user', parts: [{ text: contextText }] },
            { role: 'model', parts: [{ text: '¡Listo! Soy Coach Tríada. Ya tengo tu contexto completo. ¿Qué necesitás?' }] }
        );
      }

      // --- Build user message ---
      const promptText = message || '¿Qué ves en esta imagen?';
      this.chatHistory.push({ role: 'user', parts: [{ text: promptText }] });

      // Ensure the history array being sent to Gemini API starts with 'user'
      let historyToSend = this.chatHistory.slice(0, -1);
      while (historyToSend.length > 0 && historyToSend[0].role !== 'user') {
        historyToSend.shift();
      }

      const responseText = await this.baseAi.generateContent(
        promptText,
        false,
        imageBase64,
        mimeType,
        historyToSend
      );

      this.chatHistory.push({ role: 'model', parts: [{ text: responseText }] });

      // --- Persist to Firestore if we have a workoutId ---
      if (workoutId) {
        const now = new Date().toISOString();
        const userMsg: ChatMessage = {
          id: `${Date.now()}_u`,
          workoutId,
          role: 'user',
          text: promptText,
          timestamp: now
        };
        const coachMsg: ChatMessage = {
          id: `${Date.now()}_c`,
          workoutId,
          role: 'coach',
          text: responseText,
          timestamp: new Date().toISOString()
        };
        await this.storageService.saveChatMessage(workoutId, userMsg);
        await this.storageService.saveChatMessage(workoutId, coachMsg);

        // We don't manually update this.messages signal here because 
        // loadChatHistory has a real-time subscription to getChatHistory
      }

      return responseText;
    } catch (err: unknown) {
      console.error('Error al chatear con Coach:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        return 'Paciencia, fiera. Estoy recuperando el aliento. Intentá de nuevo en unos segundos.';
      }
      return '¡Ey fiera! Hubo un calambre en el sistema. Dame un respiro y volvé a intentar.';
    }
  }

  private buildInitialContext(workoutId: string | null): string {
    const metrics     = this.metricsService.weeklyMetrics();
    const userProfile = this.profileState.profile();

    const allWorkouts = this.workoutService.workouts();
    const activeWorkout: Workout | undefined = workoutId
      ? allWorkouts.find(w => w.id === workoutId)
      : allWorkouts.find(w => w.status === 'active');

    const workoutContext = activeWorkout
      ? `\nRUTINA ACTIVA AHORA MISMO:
Nombre: "${activeWorkout.nombre}"
Músculos objetivo: ${(activeWorkout.musculos || []).join(', ')}
Ejercicios de HOY:
${activeWorkout.ejercicios.map((e, i: number) => `  ${i+1}. ${e.nombre} - ${e.series}x${e.repeticiones} @ ${e.pesokg || 0}kg [${e.grupoMuscular}]`).join('\n')}
ESTA RUTINA ES TU PRIORIDAD. Cuando el usuario pregunte "qué toca hoy" o "cómo hago X", responde SIEMPRE en el contexto de ESTA rutina.`
      : `\nNo hay rutina activa ahora mismo. Historial de rutinas disponible.`;

    const statusMap = this.recoveryService.getMuscleRecoveryStatus()();
    const fatigueLines: string[] = [];
    statusMap.forEach((status) => {
      let icon = '🟢';
      if (status.percentage <= 30) {
        icon = '🔴';
      } else if (status.percentage <= 75) {
        icon = '🟡';
      }
      fatigueLines.push(`  ${icon} ${status.name}: ${status.percentage}% recuperado`);
    });
    const fatigueContext = fatigueLines.length > 0
      ? fatigueLines.join('\n')
      : '  Sin datos de sesiones previas (músculos al 100%)';

    const equipment: string[] = userProfile?.equipment || [];
    const equipmentContext = equipment.length > 0
      ? equipment.join(', ')
      : 'No especificado';

    return `Eres "Coach Tríada", un entrenador personal de Medellín con 15 años de experiencia. Hablas como un profe de gimnasio: directo, técnico y motivador. NUNCA digas "como IA" o "mi red neuronal". Si el usuario pregunta algo médico serio, remítelo a un profesional.

REGLAS DE RESPUESTA:
- Sé conciso (máximo 3-4 párrafos cortos).
- Usa negritas para resaltar números clave.
- Si explicas la técnica de un ejercicio, al FINAL siempre agrega: "Acordate que en la tarjeta del ejercicio tenés el botón ⓘ para ver el video de la técnica."
- NUNCA inventes datos que no estén en el contexto.
- Usa el estado de fatiga y el equipamiento para dar recomendaciones INTELIGENTES. No los menciones mecánicamente, úsalos solo para tomar decisiones sobre qué recomendar.

PERFIL DEL ATLETA:
- Peso: ${userProfile?.weight}kg | Altura: ${userProfile?.height}cm | Nivel: ${userProfile?.fitnessLevel} | Objetivo: ${userProfile?.goal}
- InBody — Músculo: ${userProfile?.inbodyData?.muscleKg || 'N/A'}kg | Grasa: ${userProfile?.inbodyData?.fatPercent || 'N/A'}%

EQUIPAMIENTO DISPONIBLE EN SU GIMNASIO:
${equipmentContext}

ESTADO DE FATIGA MUSCULAR (TIEMPO REAL):
${fatigueContext}

MÉTRICAS SEMANA ACTUAL:
- Sesiones: ${metrics.workoutsCount} | Tonelaje: ${metrics.totalVolume}kg | Series totales: ${metrics.totalSets} | Calorías: ${metrics.estimatedCalories}kcal
${workoutContext}

HISTORIAL COMPLETO DE RUTINAS (para contexto de fatiga/progresión):
${JSON.stringify(allWorkouts.map(w => ({ nombre: w.nombre, fecha: w.fecha, isCompleted: w.isCompleted, musculos: w.musculos })))}
Cardio (7d): ${JSON.stringify(this.cardioService.cardioSessions())}`;
  }
}
