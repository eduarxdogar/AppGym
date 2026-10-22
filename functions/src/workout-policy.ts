export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: string;
  imageUrl?: string;
  equipment?: string;
  equipmentRequired?: string[];
}

export function isBodyweightProfile(profile: Record<string, unknown>): boolean {
  const available = profile.availableEquipment;
  const gym = typeof profile.baseGym === 'string' ? profile.baseGym.trim().toLowerCase() : '';
  const equipment = profile.equipment;
  if (!gym || ['home gym', 'calistenia'].includes(gym)) return true;
  if (Array.isArray(available) && available.length === 1 && available[0] === 'BODYWEIGHT') return true;
  if (Array.isArray(equipment)) return !equipment.length
    || equipment.every(item => ['calistenia', 'bodyweight'].includes(String(item).trim().toLowerCase()));
  return !Array.isArray(available) || !available.length;
}

export function bodyweightPolicy(catalog: CatalogExercise[]): { systemInstruction: string; validateOutput: (text: string) => string } {
  const safe = catalog.filter(item => item.id && item.name && item.muscleGroup && (item.equipment === 'body only'
    || (!item.equipment && item.equipmentRequired?.length === 1 && ['Calistenia', 'BODYWEIGHT'].includes(item.equipmentRequired[0]))));
  if (!safe.length) throw new Error('Bodyweight catalog unavailable');
  const byId = new Map(safe.map(item => [item.id, item]));
  const byName = new Map(safe.map(item => [item.name.toLowerCase(), item]));
  return {
    systemInstruction: `RESTRICCIÓN DE EQUIPO DEL SERVIDOR: availableEquipment = ["BODYWEIGHT"].
Genera SOLO calistenia de peso corporal del catálogo siguiente. Esta restricción prevalece sobre cualquier
indicación de máquinas, mancuernas, barra con discos, poleas, cargas externas o dropsets del prompt/historial.
Usa el id y nombre EXACTOS del catálogo en cada ejercicio. pesokg SIEMPRE 0. Adapta dificultad con técnica,
tempo, repeticiones y descansos. Conserva el formato JSON Workout solicitado (objeto o array semanal).
No inventes ejercicios ni equipamiento. Catálogo permitido (id, nombre, músculo):
${JSON.stringify(safe.map(item => [item.id, item.name, item.muscleGroup]))}`,
    validateOutput: text => {
      const parsed: unknown = JSON.parse(text);
      const record = (value: unknown): Record<string, unknown> => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid workout');
        return value as Record<string, unknown>;
      };
      const validateExercise = (value: unknown, depth = 0): void => {
        if (depth > 1) throw new Error('Invalid superset');
        const exercise = record(value);
        const entry = byId.get(String(exercise.id)) ?? (typeof exercise.nombre === 'string' ? byName.get(exercise.nombre.trim().toLowerCase()) : undefined);
        if (!entry) throw new Error('Exercise outside bodyweight catalog');
        exercise.id = entry.id;
        exercise.nombre = entry.name;
        exercise.grupoMuscular = entry.muscleGroup;
        exercise.pesokg = 0;
        exercise.equipmentRequired = ['BODYWEIGHT'];
        if (entry.imageUrl) exercise.imageUrl = entry.imageUrl;
        if (exercise.dropSet !== undefined) throw new Error('External load technique not allowed');
        if (exercise.superSetEjercicio !== undefined) validateExercise(exercise.superSetEjercicio, depth + 1);
      };
      const workouts = Array.isArray(parsed) ? parsed : [parsed];
      if (!workouts.length || workouts.length > 7) throw new Error('Invalid workout count');
      for (const value of workouts) {
        const workout = record(value);
        if (!Array.isArray(workout.ejercicios) || !workout.ejercicios.length || workout.ejercicios.length > 30) throw new Error('Invalid exercises');
        workout.ejercicios.forEach(exercise => validateExercise(exercise));
      }
      return JSON.stringify(parsed);
    },
  };
}
