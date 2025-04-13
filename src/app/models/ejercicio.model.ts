export interface Ejercicio {
  id: number;
  nombre: string;
  grupoMuscular: string;
  tipo?: 'aislado' | 'compuesto';
  tipos?: 'normal' | 'top-set' | 'back-set' | 'drop-set' | 'super-serie';
  series: number;
  repeticiones: number;
  descanso?: string;
  pesokg?: number;
  serieCalentamiento?: number;
  repeticionesCalentamiento?: number;
  dificultad?: 'baja' | 'media' | 'alta';
  rir?: number;
  parciales?: boolean;

  // NUEVO PARA DROP SET
  dropSet?: {
    sets: {
      porcentaje: number;
      repeticiones: number;
      peso?: number; // Peso específico para cada set
    }[];
  };

  // NUEVO PARA SUPER SET
  superSetEjercicio?: Ejercicio;
}
