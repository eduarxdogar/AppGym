import { z } from 'zod';

export const EjercicioSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.number(),
    nombre: z.string().optional(),
    name: z.string().optional(),
    grupoMuscular: z.string().optional(),
    tipo: z.enum(['aislado', 'compuesto']).optional(),
    tipos: z.enum(['normal', 'top-set', 'back-set', 'drop-set', 'super-serie']).optional(),
    series: z.number().optional(),
    sets: z.any().optional(),
    repeticiones: z.number().optional(),
    reps: z.any().optional(),
    descanso: z.string().optional(),
    pesokg: z.number().optional(),
    weight: z.number().optional(),
    reasoning: z.string().describe("Escribe aquí el cálculo matemático. Ej: 115 * 1.025 = 117.8, redondeado a 117.5").optional(),
    serieCalentamiento: z.number().optional(),
    repeticionesCalentamiento: z.number().optional(),
    dificultad: z.enum(['baja', 'media', 'alta']).optional(),
    rir: z.number().nullable().optional().catch(2),
    parciales: z.boolean().optional(),
    videoUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    equipmentRequired: z.array(z.string()).optional(),
    notas: z.string().optional(),
    dropSet: z.object({
      sets: z.array(z.object({
        porcentaje: z.number(),
        repeticiones: z.number(),
        peso: z.number().optional(),
      })),
    }).optional(),
    superSetEjercicio: EjercicioSchema.optional(),
  }).passthrough()
);

export type Ejercicio = z.infer<typeof EjercicioSchema>;
