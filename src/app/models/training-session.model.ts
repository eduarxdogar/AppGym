export interface TrainingSession {
    id: number;
    workoutId: number;
    nombre: string;
    fechaInicio: Date;
    fechaFin?: Date;
    duracion?: string;
    pesoTotal?: number;
    // Podrías agregar duración, fecha final, etc.
  }