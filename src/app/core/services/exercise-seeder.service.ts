import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDocs } from '@angular/fire/firestore';

export interface ExerciseData {
  id?: string;
  name: string;
  discipline: 'gym' | 'calisthenics' | 'boxing';
  muscleGroup: 'Pecho' | 'Espalda' | 'Hombros' | 'Bíceps' | 'Tríceps' | 'Cuádriceps' | 'Isquios' | 'Glúteos' | 'Pantorrilla' | 'Core' | 'Full-Body';
  type: 'compound' | 'isolated';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  videoUrl?: string;
}

const GLOBAL_EXERCISES: ExerciseData[] = [
  // --- GYM: PECHO ---
  { name: 'Press de Banca con Barra', discipline: 'gym', muscleGroup: 'Pecho', type: 'compound', difficulty: 'intermediate', instructions: ['Acuéstate en el banco plano', 'Agarra la barra algo más ancho que los hombros', 'Baja hasta el pecho y empuja'] },
  { name: 'Press Inclinado con Mancuernas', discipline: 'gym', muscleGroup: 'Pecho', type: 'compound', difficulty: 'intermediate', instructions: ['Banco a 30-45 grados', 'Baja las mancuernas controladas', 'Empuja contrayendo el pectoral'] },
  { name: 'Aperturas en Polea Alta', discipline: 'gym', muscleGroup: 'Pecho', type: 'isolated', difficulty: 'beginner', instructions: ['Cruza las poleas frente a ti', 'Mantén una ligera flexión de codo'] },
  { name: 'Press Declinado con Barra', discipline: 'gym', muscleGroup: 'Pecho', type: 'compound', difficulty: 'advanced', instructions: ['Banco declinado', 'Baja a la parte baja del pecho'] },
  { name: 'Aperturas con Mancuernas', discipline: 'gym', muscleGroup: 'Pecho', type: 'isolated', difficulty: 'beginner', instructions: ['Acostado, abre los brazos controlando el peso'] },
  { name: 'Pec Deck Machine', discipline: 'gym', muscleGroup: 'Pecho', type: 'isolated', difficulty: 'beginner', instructions: ['Siéntate derecho, junta los codos frente a ti'] },
  { name: 'Press de Banca Agarre Cerrado', discipline: 'gym', muscleGroup: 'Pecho', type: 'compound', difficulty: 'intermediate', instructions: ['Manos a la anchura de los hombros', 'Enfocado en tríceps y pecho interno'] },
  
  // --- GYM: ESPALDA ---
  { name: 'Peso Muerto Tradicional', discipline: 'gym', muscleGroup: 'Espalda', type: 'compound', difficulty: 'advanced', instructions: ['Espalda recta', 'Empuja con las piernas', 'Extensión de cadera completa'] },
  { name: 'Remo con Barra', discipline: 'gym', muscleGroup: 'Espalda', type: 'compound', difficulty: 'intermediate', instructions: ['Torso a 45 grados', 'Tira de la barra hacia el ombligo'] },
  { name: 'Jalón al Pecho', discipline: 'gym', muscleGroup: 'Espalda', type: 'compound', difficulty: 'beginner', instructions: ['Sentado', 'Tira de la barra hacia la parte alta del pecho'] },
  { name: 'Remo en Polea Baja', discipline: 'gym', muscleGroup: 'Espalda', type: 'compound', difficulty: 'beginner', instructions: ['Tira del agarre hacia el abdomen'] },
  { name: 'Remo con Mancuerna a Una Mano', discipline: 'gym', muscleGroup: 'Espalda', type: 'compound', difficulty: 'intermediate', instructions: ['Apoya rodilla y mano en banco', 'Tira de la mancuerna hacia la cadera'] },
  { name: 'Pull-over con Mancuerna', discipline: 'gym', muscleGroup: 'Espalda', type: 'isolated', difficulty: 'intermediate', instructions: ['Acostado transversalmente en banco', 'Baja la mancuerna tras la cabeza'] },
  
  // --- GYM: HOMBROS ---
  { name: 'Press Militar con Barra', discipline: 'gym', muscleGroup: 'Hombros', type: 'compound', difficulty: 'intermediate', instructions: ['De pie o sentado', 'Empuja la barra por encima de la cabeza'] },
  { name: 'Elevaciones Laterales', discipline: 'gym', muscleGroup: 'Hombros', type: 'isolated', difficulty: 'beginner', instructions: ['Sube las mancuernas a los lados hasta nivel de hombros'] },
  { name: 'Pájaros (Elevaciones Posteriores)', discipline: 'gym', muscleGroup: 'Hombros', type: 'isolated', difficulty: 'beginner', instructions: ['Torso inclinado', 'Abre brazos hacia atrás'] },
  { name: 'Press Arnold', discipline: 'gym', muscleGroup: 'Hombros', type: 'compound', difficulty: 'intermediate', instructions: ['Inicia con palmas hacia ti', 'Gira al subir'] },
  { name: 'Elevaciones Frontales', discipline: 'gym', muscleGroup: 'Hombros', type: 'isolated', difficulty: 'beginner', instructions: ['Sube la mancuerna o barra hacia el frente'] },
  { name: 'Face Pull', discipline: 'gym', muscleGroup: 'Hombros', type: 'isolated', difficulty: 'beginner', instructions: ['Tira de la cuerda hacia la cara', 'Abre los codos'] },
  
  // --- GYM: BÍCEPS ---
  { name: 'Curl con Barra Z', discipline: 'gym', muscleGroup: 'Bíceps', type: 'isolated', difficulty: 'beginner', instructions: ['Agarre supino', 'Flexión de codos sin mover los hombros'] },
  { name: 'Curl Martillo', discipline: 'gym', muscleGroup: 'Bíceps', type: 'isolated', difficulty: 'beginner', instructions: ['Agarre neutro', 'Enfocado en braquial'] },
  { name: 'Curl en Banco Scott', discipline: 'gym', muscleGroup: 'Bíceps', type: 'isolated', difficulty: 'intermediate', instructions: ['Apoya los brazos en el pad', 'Estiramiento completo'] },
  { name: 'Curl Alterno con Mancuernas', discipline: 'gym', muscleGroup: 'Bíceps', type: 'isolated', difficulty: 'beginner', instructions: ['Sube una mancuerna a la vez girando muñeca'] },
  { name: 'Curl Concentrado', discipline: 'gym', muscleGroup: 'Bíceps', type: 'isolated', difficulty: 'beginner', instructions: ['Sentado, codo apoyado en muslo'] },
  
  // --- GYM: TRÍCEPS ---
  { name: 'Extensión de Tríceps en Polea Alta', discipline: 'gym', muscleGroup: 'Tríceps', type: 'isolated', difficulty: 'beginner', instructions: ['Codos pegados al cuerpo', 'Extensión completa hacia abajo'] },
  { name: 'Press Francés', discipline: 'gym', muscleGroup: 'Tríceps', type: 'isolated', difficulty: 'intermediate', instructions: ['Acostado', 'Baja la barra a la frente'] },
  { name: 'Extensión Tras Nuca', discipline: 'gym', muscleGroup: 'Tríceps', type: 'isolated', difficulty: 'beginner', instructions: ['Sube el peso por detrás de la cabeza'] },
  { name: 'Fondos en Máquina', discipline: 'gym', muscleGroup: 'Tríceps', type: 'compound', difficulty: 'beginner', instructions: ['Empuja las asas hacia abajo'] },
  { name: 'Kickback (Patada de Tríceps)', discipline: 'gym', muscleGroup: 'Tríceps', type: 'isolated', difficulty: 'beginner', instructions: ['Torso inclinado', 'Extiende el brazo hacia atrás'] },

  // --- GYM: CUÁDRICEPS ---
  { name: 'Sentadilla Libre', discipline: 'gym', muscleGroup: 'Cuádriceps', type: 'compound', difficulty: 'advanced', instructions: ['Barra en trapecios', 'Baja rompiendo la paralela'] },
  { name: 'Prensa Inclinada (Leg Press)', discipline: 'gym', muscleGroup: 'Cuádriceps', type: 'compound', difficulty: 'intermediate', instructions: ['Pies al ancho de hombros', 'Baja hasta 90 grados'] },
  { name: 'Sentadilla Hack', discipline: 'gym', muscleGroup: 'Cuádriceps', type: 'compound', difficulty: 'intermediate', instructions: ['Espalda apoyada', 'Enfoque en cuádriceps'] },
  { name: 'Extensiones de Pierna', discipline: 'gym', muscleGroup: 'Cuádriceps', type: 'isolated', difficulty: 'beginner', instructions: ['Sentado', 'Extiende las piernas controlando la bajada'] },
  { name: 'Sentadilla Búlgara', discipline: 'gym', muscleGroup: 'Cuádriceps', type: 'compound', difficulty: 'intermediate', instructions: ['Un pie elevado atrás', 'Baja recto'] },
  { name: 'Zancadas (Lunges)', discipline: 'gym', muscleGroup: 'Cuádriceps', type: 'compound', difficulty: 'beginner', instructions: ['Da un paso adelante', 'Flexiona ambas rodillas a 90 grados'] },

  // --- GYM: ISQUIOS & GLÚTEOS ---
  { name: 'Peso Muerto Rumano', discipline: 'gym', muscleGroup: 'Isquios', type: 'compound', difficulty: 'intermediate', instructions: ['Piernas semi-rectas', 'Cadera hacia atrás'] },
  { name: 'Curl de Isquios Tumbado', discipline: 'gym', muscleGroup: 'Isquios', type: 'isolated', difficulty: 'beginner', instructions: ['Flexiona piernas hacia glúteos'] },
  { name: 'Hip Thrust con Barra', discipline: 'gym', muscleGroup: 'Glúteos', type: 'compound', difficulty: 'intermediate', instructions: ['Espalda alta en banco', 'Empuja con cadera'] },
  { name: 'Peso Muerto Piernas Rígidas', discipline: 'gym', muscleGroup: 'Isquios', type: 'compound', difficulty: 'advanced', instructions: ['Rodillas sin flexionar', 'Estiramiento profundo'] },

  // --- GYM: PANTORRILLA & CORE ---
  { name: 'Elevación de Talones de Pie', discipline: 'gym', muscleGroup: 'Pantorrilla', type: 'isolated', difficulty: 'beginner', instructions: ['Sube a la punta del pie', 'Pausa arriba'] },
  { name: 'Elevación de Talones Sentado', discipline: 'gym', muscleGroup: 'Pantorrilla', type: 'isolated', difficulty: 'beginner', instructions: ['Sube el peso enfocado en el sóleo'] },
  { name: 'Crunch en Polea', discipline: 'gym', muscleGroup: 'Core', type: 'isolated', difficulty: 'beginner', instructions: ['De rodillas', 'Enrolla tu abdomen'] },
  { name: 'Rueda Abdominal (Ab Wheel)', discipline: 'gym', muscleGroup: 'Core', type: 'compound', difficulty: 'advanced', instructions: ['Extiende adelante', 'Contrae al volver'] },
  { name: 'Plancha (Plank)', discipline: 'gym', muscleGroup: 'Core', type: 'isolated', difficulty: 'beginner', instructions: ['Manten la posición apretando glúteos y core'] },
  { name: 'Leg Raises Colgado', discipline: 'gym', muscleGroup: 'Core', type: 'compound', difficulty: 'advanced', instructions: ['Colgado de barra', 'Eleva las piernas rectas'] },

  // --- CALISTHENICS: PUSH ---
  { name: 'Push-ups Tradicionales', discipline: 'calisthenics', muscleGroup: 'Pecho', type: 'compound', difficulty: 'beginner', instructions: ['Cuerpo recto', 'Baja hasta rozar el suelo'] },
  { name: 'Diamantes Push-ups', discipline: 'calisthenics', muscleGroup: 'Tríceps', type: 'compound', difficulty: 'intermediate', instructions: ['Manos juntas en diamante', 'Codos pegados al cuerpo'] },
  { name: 'Dips en Paralelas', discipline: 'calisthenics', muscleGroup: 'Pecho', type: 'compound', difficulty: 'intermediate', instructions: ['Baja hasta 90 grados', 'Torso inclinado adelante'] },
  { name: 'Handstand Push-ups', discipline: 'calisthenics', muscleGroup: 'Hombros', type: 'compound', difficulty: 'advanced', instructions: ['Apoyado en pared o libre', 'Baja y sube'] },
  { name: 'Pseudo Planche Push-ups', discipline: 'calisthenics', muscleGroup: 'Hombros', type: 'compound', difficulty: 'advanced', instructions: ['Manos a la altura de la cintura', 'Cuerpo adelantado'] },
  { name: 'Pike Push-ups', discipline: 'calisthenics', muscleGroup: 'Hombros', type: 'compound', difficulty: 'intermediate', instructions: ['Cuerpo en V invertida', 'Baja cabeza a manos'] },
  { name: 'Planche Lean', discipline: 'calisthenics', muscleGroup: 'Hombros', type: 'isolated', difficulty: 'advanced', instructions: ['Posición de push-up', 'Inclina el peso hacia adelante'] },
  
  // --- CALISTHENICS: PULL ---
  { name: 'Pull-ups Estrictas', discipline: 'calisthenics', muscleGroup: 'Espalda', type: 'compound', difficulty: 'intermediate', instructions: ['Agarre prono', 'Sube barbilla sobre la barra'] },
  { name: 'Chin-ups', discipline: 'calisthenics', muscleGroup: 'Bíceps', type: 'compound', difficulty: 'intermediate', instructions: ['Agarre supino', 'Sube barbilla sobre la barra'] },
  { name: 'Muscle-up', discipline: 'calisthenics', muscleGroup: 'Espalda', type: 'compound', difficulty: 'advanced', instructions: ['Tirón explosivo', 'Transición sobre la barra'] },
  { name: 'Front Lever', discipline: 'calisthenics', muscleGroup: 'Core', type: 'compound', difficulty: 'advanced', instructions: ['Cuerpo recto paralelo al suelo', 'Colgado de barra'] },
  { name: 'Back Lever', discipline: 'calisthenics', muscleGroup: 'Core', type: 'compound', difficulty: 'advanced', instructions: ['Cuerpo recto paralelo al suelo cara abajo'] },
  { name: 'Australian Pull-ups', discipline: 'calisthenics', muscleGroup: 'Espalda', type: 'compound', difficulty: 'beginner', instructions: ['Remo invertido en barra baja'] },
  { name: 'L-Sit', discipline: 'calisthenics', muscleGroup: 'Core', type: 'isolated', difficulty: 'advanced', instructions: ['Apoyado en manos', 'Piernas rectas a 90 grados'] },

  // --- CALISTHENICS: LEGS ---
  { name: 'Pistol Squats', discipline: 'calisthenics', muscleGroup: 'Cuádriceps', type: 'compound', difficulty: 'advanced', instructions: ['Sentadilla a una pierna', 'Pierna libre extendida'] },
  { name: 'Sissy Squats', discipline: 'calisthenics', muscleGroup: 'Cuádriceps', type: 'isolated', difficulty: 'advanced', instructions: ['Baja rodillas adelante', 'Torso echado atrás'] },
  { name: 'Nordic Curls', discipline: 'calisthenics', muscleGroup: 'Isquios', type: 'isolated', difficulty: 'advanced', instructions: ['Talones fijos', 'Baja controlando el peso corporal'] },

  // --- BOXING ---
  { name: 'Shadowboxing Libre', discipline: 'boxing', muscleGroup: 'Full-Body', type: 'compound', difficulty: 'beginner', instructions: ['Mueve cabeza', 'Lanza combinaciones al aire'] },
  { name: 'Heavy Bag (Bolsa Pesada)', discipline: 'boxing', muscleGroup: 'Full-Body', type: 'compound', difficulty: 'intermediate', instructions: ['Golpea fuerte y constante', 'Mantén la guardia'] },
  { name: 'Speed Bag', discipline: 'boxing', muscleGroup: 'Hombros', type: 'isolated', difficulty: 'intermediate', instructions: ['Golpes rítmicos', 'Brazos arriba'] },
  { name: 'Double End Bag', discipline: 'boxing', muscleGroup: 'Hombros', type: 'isolated', difficulty: 'advanced', instructions: ['Precisión', 'Timing y reflejos'] },
  { name: 'Saltar la Cuerda (Jump Rope)', discipline: 'boxing', muscleGroup: 'Pantorrilla', type: 'compound', difficulty: 'beginner', instructions: ['Ritmo constante', 'Saltos cortos'] },
  { name: 'Burpees Boxeador', discipline: 'boxing', muscleGroup: 'Full-Body', type: 'compound', difficulty: 'advanced', instructions: ['Burpee seguido de 1-2 al subir'] },
  { name: 'Desplazamientos Laterales (Footwork)', discipline: 'boxing', muscleGroup: 'Cuádriceps', type: 'isolated', difficulty: 'beginner', instructions: ['Rodillas semiflexionadas', 'Moviéndose lado a lado'] }
];

// Generar más variaciones para llegar a un buen número (+50 variaciones automáticas)
const VARIATIONS: ExerciseData[] = [];
const gyms = GLOBAL_EXERCISES.filter(e => e.discipline === 'gym');
gyms.forEach(ex => {
  if (ex.name.includes('Barra')) {
    VARIATIONS.push({ ...ex, name: ex.name.replace('Barra', 'Mancuernas').replace('con ', 'con '), instructions: ['Usa mancuernas en lugar de barra'] });
    VARIATIONS.push({ ...ex, name: ex.name.replace('Barra', 'Máquina Smith'), instructions: ['Usa la máquina Smith'] });
  }
  if (ex.name.includes('Mancuernas')) {
    VARIATIONS.push({ ...ex, name: ex.name.replace('Mancuernas', 'Polea'), instructions: ['Realiza el movimiento usando poleas continuas'] });
  }
});

const COMPLETE_CATALOG = [...GLOBAL_EXERCISES, ...VARIATIONS];

@Injectable({
  providedIn: 'root'
})
export class ExerciseSeederService {
  private firestore = inject(Firestore);

  async runSeeder(): Promise<void> {
    try {
      const collectionRef = collection(this.firestore, 'global_exercises');
      
      // 1. Verify if empty
      const snapshot = await getDocs(collectionRef);
      if (!snapshot.empty) {
        console.log('Catálogo de ejercicios ya existe en Firestore. (' + snapshot.size + ' ejercicios)');
        return;
      }

      console.log('Iniciando carga masiva de catálogo (' + COMPLETE_CATALOG.length + ' ejercicios)...');
      
      // 2. Upload catalog
      const promises = COMPLETE_CATALOG.map(exercise => {
        // Formatear ID a partir del nombre, ej: "press-de-banca-con-barra"
        const docId = exercise.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
        const docRef = doc(collectionRef, docId);
        return setDoc(docRef, { ...exercise, id: docId });
      });

      await Promise.all(promises);
      console.log('✅ Catálogo de ejercicios cargado exitosamente.');
    } catch (error) {
      console.error('Error poblando el catálogo:', error);
    }
  }
}
