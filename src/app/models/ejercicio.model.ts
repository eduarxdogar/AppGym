export interface Ejercicio {
    id: number;
    nombre: string;
    grupoMuscular: 'pecho' | 'espalda' | 'piernas' | 'hombros' | 'bíceps' | 'tríceps' | 'core' | 'otros';
    tipo: 'compuesto' | 'aislamiento';
    series: number;
    repeticiones: number;  
    descanso: string;
    metodo?: string;
    pesokg?: number;
  }
  