import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BaseAiService } from './base-ai.service';
import { UserProfileStateService } from '../user-profile-state.service';
import { WorkoutService } from '../workout.service';
import { MetricsService } from '../metrics.service';
import { CardioSessionService } from '../cardio-session.service';
import { StorageService } from '../storage.service';
import { ChatMessage } from '../../models/ai-requests.model';
import { ExerciseImageService } from '../exercise-image.service';
import { RecoveryService } from '../recovery.service';
import { Workout } from '../../models/workout.model';
import { AuthService } from '../auth.service';
import { ToastService } from '../toast.service';
import { aiErrorMessage } from '../../utils/ai-error-message';

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
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private historySubscription?: Subscription;
  private ownerUid = this.auth.currentUser()?.uid ?? null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.historySubscription?.unsubscribe());
    effect(() => {
      const uid = this.auth.currentUser()?.uid ?? null;
      if (uid !== this.ownerUid) {
        this.ownerUid = uid;
        this.resetChat();
      }
    });
  }

  /** Currently active workout context for the coach */
  private readonly activeWorkoutId = signal<string | null>(null);
  private chatHistory: { role: string; parts: { text: string }[] }[] = [];

  /** Persisted messages loaded from Firestore */
  readonly messages = signal<ChatMessage[]>([]);

  resetChat() {
    this.historySubscription?.unsubscribe();
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
    this.historySubscription?.unsubscribe();
    this.historySubscription = this.storageService.getChatHistory(workoutId).subscribe({
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
    const ownerUid = this.auth.currentUser()?.uid;
    const previousHistory = [...this.chatHistory];
    const promptText = message || '¿Qué ves en esta imagen?';
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), workoutId: workoutId ?? 'global', role: 'user',
      text: promptText, timestamp: new Date().toISOString(),
    };
    this.messages.update(messages => [...messages, userMsg]);

    try {
      // Refresh profile/fatigue context even when a saved conversation is restored.
      const historyToSend = [
        { role: 'user', parts: [{ text: this.buildInitialContext(workoutId) }] },
        { role: 'model', parts: [{ text: 'Tengo el contexto actual del atleta.' }] },
        ...this.chatHistory.slice(-48),
      ];

      const responseText = await this.baseAi.generateContent(
        promptText,
        false,
        imageBase64,
        mimeType,
        historyToSend
      );

      if (this.auth.currentUser()?.uid !== ownerUid || (targetWorkoutId === undefined && this.activeWorkoutId() !== workoutId)) return responseText;

      this.chatHistory.push({ role: 'user', parts: [{ text: promptText }] },
        { role: 'model', parts: [{ text: responseText }] });
      const coachMsg: ChatMessage = { id: crypto.randomUUID(), workoutId: workoutId ?? 'global',
        role: 'coach', text: responseText, timestamp: new Date().toISOString() };
      this.messages.update(messages => [...messages, coachMsg]);

      // --- Persist to Firestore if we have a workoutId ---
      if (workoutId) {
        try {
          await this.storageService.saveChatMessages(workoutId, [userMsg, coachMsg]);
        } catch {
          this.toast.showError('El Coach respondió, pero no pudimos guardar la conversación.');
        }
      }

      return responseText;
    } catch (err: unknown) {
      console.error('Error al chatear con Coach:', err);
      const errorMessage = aiErrorMessage(err, 'No pudimos obtener una respuesta del Coach. Inténtalo de nuevo.');
      if (this.auth.currentUser()?.uid === ownerUid && (targetWorkoutId !== undefined || this.activeWorkoutId() === workoutId)) {
        this.chatHistory = previousHistory;
        this.messages.update(messages => [...messages, { id: crypto.randomUUID(), workoutId: workoutId ?? 'global',
          role: 'coach', text: errorMessage, timestamp: new Date().toISOString() }]);
      }
      return errorMessage;
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
