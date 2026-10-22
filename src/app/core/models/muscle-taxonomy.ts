import type { MuscleStatus } from './workout-history.model';

export const MUSCLES = [
  'Pecho', 'Espalda', 'Hombro Anterior', 'Hombro Lateral', 'Hombro Posterior',
  'Bíceps', 'Tríceps', 'Antebrazos', 'Cuádriceps', 'Isquios', 'Glúteos',
  'Gemelos', 'Core', 'Trapecio', 'Lumbares'
] as const;
export type Muscle = typeof MUSCLES[number];

const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[_-]+/g, ' ').trim();
const aliases: Record<string, Muscle> = {
  chest: 'Pecho', pectorales: 'Pecho', back: 'Espalda', dorsales: 'Espalda',
  hombros: 'Hombro Lateral', hombro: 'Hombro Lateral', shoulders: 'Hombro Lateral', deltoides: 'Hombro Lateral',
  'deltoides anterior': 'Hombro Anterior', 'anterior deltoid': 'Hombro Anterior', 'front delt': 'Hombro Anterior',
  'deltoides lateral': 'Hombro Lateral', 'lateral deltoid': 'Hombro Lateral', 'side delt': 'Hombro Lateral',
  'deltoides posterior': 'Hombro Posterior', 'posterior deltoid': 'Hombro Posterior', 'rear delt': 'Hombro Posterior',
  forearms: 'Antebrazos', quads: 'Cuádriceps', piernas: 'Cuádriceps', hamstrings: 'Isquios',
  glutes: 'Glúteos', calves: 'Gemelos', abs: 'Core', abdominales: 'Core', traps: 'Trapecio', 'lower back': 'Lumbares'
};
for (const muscle of MUSCLES) aliases[key(muscle)] = muscle;

export function canonicalMuscle(value: string | undefined | null): Muscle | undefined {
  return value ? aliases[key(value)] : undefined;
}

// The GLB has one deltoid mesh on each side: show the least recovered head.
export function musclesForMesh(meshName: string): readonly Muscle[] {
  if (meshName.startsWith('Deltoid_')) return ['Hombro Anterior', 'Hombro Lateral', 'Hombro Posterior'];
  const meshes: Record<string, Muscle> = {
    Pectoral: 'Pecho', Lats: 'Espalda', Traps: 'Trapecio', LowerBack: 'Lumbares',
    Quadriceps: 'Cuádriceps', Hamstrings: 'Isquios', Calves: 'Gemelos', Glutes: 'Glúteos',
    Biceps: 'Bíceps', Triceps: 'Tríceps', Forearms: 'Antebrazos', Abs: 'Core'
  };
  const prefix = meshName.split('_')[0];
  return meshes[prefix] ? [meshes[prefix]] : [];
}

export function statusForMesh(meshName: string, statuses: Map<string, MuscleStatus>): MuscleStatus | undefined {
  return musclesForMesh(meshName).map(muscle => statuses.get(muscle))
    .filter((status): status is MuscleStatus => status !== undefined)
    .reduce<MuscleStatus | undefined>((worst, status) => !worst || status.percentage < worst.percentage ? status : worst, undefined);
}
