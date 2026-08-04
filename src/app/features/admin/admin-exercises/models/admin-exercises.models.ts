export interface AdminExercise {
  id?: string;
  name: string;
  discipline: string;
  muscleGroup: string;
  type: string;
  difficulty: string;
  instructions: string[];
  equipmentRequired: string[];
  imageUrl: string;
  videoUrl?: string;
}
