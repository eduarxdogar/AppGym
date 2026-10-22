import { z } from 'zod';

const segmentValue = z.string().trim().max(100)
  .regex(/^\d+(?:[.,]\d+)?\s*kg(?:\s*\(\d+(?:[.,]\d+)?%\))?$/i).nullable().default(null);
const SegmentalScanSchema = z.object({
  rightArm: segmentValue, leftArm: segmentValue, trunk: segmentValue,
  rightLeg: segmentValue, leftLeg: segmentValue,
}).strict();
const segmentalBlock = SegmentalScanSchema.nullish().transform(value => SegmentalScanSchema.parse(value ?? {}));
const measurement = z.number().finite().nonnegative().nullable().default(null);

export const InbodyScanSchema = z.object({
  muscleKg: measurement,
  fatPercent: z.number().finite().min(0).max(100).nullable().default(null),
  bmr: measurement,
  waterPercentage: z.number().finite().min(0).max(100).nullable().default(null),
  visceralFat: measurement,
  boneMass: measurement,
  segmentalMuscle: segmentalBlock,
  segmentalFat: segmentalBlock,
}).strict().refine(data => [data.muscleKg, data.fatPercent, data.bmr, data.waterPercentage, data.visceralFat, data.boneMass]
  .some(value => value !== null) || [...Object.values(data.segmentalMuscle), ...Object.values(data.segmentalFat)]
  .some(value => value !== null), { message: 'El reporte no contiene mediciones legibles.' });

export type InbodyScanResult = z.infer<typeof InbodyScanSchema>;

export class InbodyValidationError extends Error {
  constructor() {
    super('No pudimos leer valores válidos del reporte. Prueba con una imagen más clara o continúa sin InBody.');
    this.name = 'InbodyValidationError';
  }
}
