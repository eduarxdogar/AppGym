export interface Ejercicio {
    id: number;
    nombre: string;
    grupoMuscular: 'otros'|'pecho' | 'espalda' | 'piernas' | 'hombros' | 'bíceps' | 'tríceps' | 'core' ;
    tipo: 'compuesto' | 'aislamiento';
    series: number;
    repeticiones: number;  
    descanso: string;
    metodo?: string;
    pesokg?: number;
    serieCalentamiento?: number;
    repeticionesCalentamiento?: number;
  }
  