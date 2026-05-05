import { Injectable } from '@angular/core';

/**
 * Mapeo determinístico de grupos musculares a imágenes representativas
 * usando la API gratuita de wger.de (sin auth).
 */
const MUSCLE_IMAGE_MAP: Record<string, string> = {
  'pecho':       'https://wger.de/static/images/muscles/main/muscle-4.svg',
  'pectorales':  'https://wger.de/static/images/muscles/main/muscle-4.svg',
  'espalda':     'https://wger.de/static/images/muscles/main/muscle-12.svg',
  'dorsales':    'https://wger.de/static/images/muscles/main/muscle-12.svg',
  'hombros':     'https://wger.de/static/images/muscles/main/muscle-2.svg',
  'deltoides':   'https://wger.de/static/images/muscles/main/muscle-2.svg',
  'bíceps':      'https://wger.de/static/images/muscles/main/muscle-1.svg',
  'biceps':      'https://wger.de/static/images/muscles/main/muscle-1.svg',
  'tríceps':     'https://wger.de/static/images/muscles/main/muscle-5.svg',
  'triceps':     'https://wger.de/static/images/muscles/main/muscle-5.svg',
  'cuádriceps':  'https://wger.de/static/images/muscles/main/muscle-10.svg',
  'cuadriceps':  'https://wger.de/static/images/muscles/main/muscle-10.svg',
  'isquios':     'https://wger.de/static/images/muscles/main/muscle-11.svg',
  'glúteos':     'https://wger.de/static/images/muscles/main/muscle-8.svg',
  'gluteos':     'https://wger.de/static/images/muscles/main/muscle-8.svg',
  'gemelos':     'https://wger.de/static/images/muscles/main/muscle-7.svg',
  'abdominales': 'https://wger.de/static/images/muscles/main/muscle-6.svg',
  'abdomen':     'https://wger.de/static/images/muscles/main/muscle-6.svg',
  'trapecios':   'https://wger.de/static/images/muscles/main/muscle-9.svg',
};

/**
 * Mapeo de nombres comunes de ejercicio a IDs de video de YouTube.
 */
const EXERCISE_VIDEO_MAP: Record<string, string> = {
  'press de banca':         'dZgVxmf6jkA',
  'press banca':            'dZgVxmf6jkA',
  'sentadilla':             'gsNoPYwWXik',
  'peso muerto':            'op9kVnSso6Q',
  'press militar':          '2yjwXTZQDDI',
  'dominadas':              'eGo4IYlbE5g',
  'pull up':                'eGo4IYlbE5g',
  'remo con barra':         '9efgcAjQe7E',
  'curl de bíceps':         'in7PaeGZ3hs',
  'curl biceps':            'in7PaeGZ3hs',
  'extensión de tríceps':   'gcy4tvK9dTY',
  'tricep':                 'gcy4tvK9dTY',
  'hip thrust':             'SEdqd1n0cvg',
  'zancada':                'D7KaRcUTQeE',
  'lunges':                 'D7KaRcUTQeE',
  'leg press':              'IZxyjW7MPJQ',
  'prensa':                 'IZxyjW7MPJQ',
  'extensión cuádriceps':   'YyvSfVjQeL0',
  'curl de piernas':        'ELOCsoDSmrg',
  'elevaciones laterales':  '3VcKaXpzqRo',
  'press inclinado':        '8iPEnn-ltC8',
  'fondos':                 'wjUmnZH528Y',
  'plancha':                'pvIjchK8RpU',
  'crunch':                 'Xyd_fa5zoEU',
};

const FALLBACK_THUMBNAIL = 'https://placehold.co/400x300/151921/CCFF00?text=Ejercicio';

@Injectable({ providedIn: 'root' })
export class ExerciseImageService {

  /** Devuelve la URL de imagen SVG del músculo dado. */
  getMuscleImage(grupoMuscular: string): string {
    const key = grupoMuscular.toLowerCase().trim();
    return MUSCLE_IMAGE_MAP[key] ?? FALLBACK_THUMBNAIL;
  }

  /** Devuelve la URL de embed de YouTube para el ejercicio, o cadena vacía si no hay mapeo. */
  getExerciseVideoUrl(exerciseName: string): string {
    const nameLower = exerciseName.toLowerCase();
    const matchedKey = Object.keys(EXERCISE_VIDEO_MAP).find(k => nameLower.includes(k));
    if (!matchedKey) return '';
    const videoId = EXERCISE_VIDEO_MAP[matchedKey];
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=1`;
  }

  /** Devuelve el thumbnail de YouTube del ejercicio, o una imagen placeholder. */
  getExerciseThumbnail(exerciseName: string): string {
    const nameLower = exerciseName.toLowerCase();
    const matchedKey = Object.keys(EXERCISE_VIDEO_MAP).find(k => nameLower.includes(k));
    if (!matchedKey) return FALLBACK_THUMBNAIL;
    const videoId = EXERCISE_VIDEO_MAP[matchedKey];
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
}
