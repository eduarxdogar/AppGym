import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BaseAiService } from './base-ai.service';
import { InbodyAiService } from './inbody-ai.service';
import { InbodyValidationError } from '../../models/inbody-scan.schema';

describe('InbodyAiService', () => {
  let service: InbodyAiService;
  let generate: jasmine.Spy;
  beforeEach(() => {
    generate = jasmine.createSpy('generateContent');
    TestBed.configureTestingModule({ providers: [{ provide: BaseAiService, useValue: {
      isConfigured: true, activeModel: signal('gemini-2.5-flash'), generateContent: generate,
      cleanJson: (text: string) => text.replace(/^```json\s*/, '').replace(/\s*```$/, ''),
    } }] });
    service = TestBed.inject(InbodyAiService);
  });
  it('fills missing or null segmental blocks with explicit null fields', async () => {
    for (const input of [{ muscleKg: 35 }, { muscleKg: 35, segmentalMuscle: null, segmentalFat: null }]) {
      generate.and.resolveTo(JSON.stringify(input));
      const result = await service.scanInBodyReport('aGVsbG8=', 'image/png');
      const empty = { rightArm: null, leftArm: null, trunk: null, rightLeg: null, leftLeg: null };
      expect(result.segmentalMuscle).toEqual(empty);
      expect(result.segmentalFat).toEqual(empty);
      expect(result.bmr).toBeNull();
      expect(Object.values(result).every(value => value !== undefined)).toBeTrue();
    }
  });
  it('keeps zero values and validates partial segmental data', async () => {
    generate.and.resolveTo('```json\n' + JSON.stringify({ fatPercent: 0, waterPercentage: 50,
      segmentalMuscle: { rightArm: '3.79kg (115.6%)' } }) + '\n```');
    const result = await service.scanInBodyReport('aGVsbG8=', 'application/pdf');
    expect(result.fatPercent).toBe(0);
    expect(result.segmentalMuscle.rightArm).toBe('3.79kg (115.6%)');
    expect(result.segmentalMuscle.leftArm).toBeNull();
    expect(generate.calls.mostRecent().args.slice(1)).toEqual([true, 'aGVsbG8=', 'application/pdf']);
  });
  it('preserves segmental kilograms without inventing missing reference percentages', async () => {
    generate.and.resolveTo(JSON.stringify({ muscleKg: 32, segmentalMuscle: { rightArm: '3.4kg', trunk: '25.5kg' },
      segmentalFat: { rightArm: '0.6kg' } }));
    const result = await service.scanInBodyReport('aGVsbG8=', 'image/png');
    expect(result.segmentalMuscle.rightArm).toBe('3.4kg');
    expect(result.segmentalMuscle.trunk).toBe('25.5kg');
    expect(result.segmentalFat.rightArm).toBe('0.6kg');
    expect(result.segmentalMuscle.leftArm).toBeNull();
  });
  it('turns invalid JSON, empty reports, impossible percentages and malformed blocks into controlled errors', async () => {
    for (const text of ['bad JSON', 'null', '[]', '{}', '{"fatPercent":101}', '{"muscleKg":-1}',
      '{"muscleKg":"35"}', '{"muscleKg":1e999}', '{"bmr":1500,"segmentalMuscle":[]}',
      '{"bmr":1500,"segmentalFat":{"rightArm":2}}', '{"bmr":1500,"uid":"injected"}']) {
      generate.and.resolveTo(text);
      await expectAsync(service.scanInBodyReport('aGVsbG8=', 'image/png')).toBeRejectedWithError(InbodyValidationError);
    }
  });
  it('preserves subscription and quota errors so the UI can explain the cause', async () => {
    const error = { code: 'functions/permission-denied' };
    generate.and.rejectWith(error);
    await expectAsync(service.scanInBodyReport('aGVsbG8=', 'image/png')).toBeRejectedWith(error);
  });
});
