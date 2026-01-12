export interface WorkoutSessionSet {
    weight: number;
    reps: number;
    completed: boolean;
    rpe?: number; // Optional: Rating of Perceived Exertion
}

export interface WorkoutSessionExercise {
    exerciseId: string | number;
    name: string;
    targetSets: number;
    sets: WorkoutSessionSet[];
    notes?: string;
}

export interface WorkoutSession {
    id: string; // Unique ID for Firestore
    userId: string;
    workoutId: number | string; // Reference to the template/plan
    name: string;
    startTime: string; // ISO String
    endTime: string; // ISO String
    duration: string; // Formatted string or milliseconds
    totalVolume: number; // Tonnage
    musclesWorked: string[];
    exercises: WorkoutSessionExercise[];
    feeling?: 'good' | 'tired' | 'average' | 'strong'; // User feedback
    calories?: number;
}
