export interface TrainingSession {
    id: number;
    sessionId?: string;
    userId?: string;
    workoutId: string;
    nombre: string;
    fechaInicio: Date;
    fechaFin?: Date;
    duracion?: string;
    pesoTotal?: number;
    // Podrías agregar duración, fecha final, etc.
  }
