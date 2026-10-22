import { TestBed } from '@angular/core/testing';
import { AI_REQUEST, BaseAiService } from './base-ai.service';

describe('BaseAiService', () => {
  let service: BaseAiService;
  let request: jasmine.Spy;
  beforeEach(() => {
    request = jasmine.createSpy('AI_REQUEST');
    TestBed.configureTestingModule({ providers: [{ provide: AI_REQUEST, useValue: request }] });
    service = TestBed.inject(BaseAiService);
  });
  it('retries one unavailable transport failure and sends no client API keys', async () => {
    request.and.returnValues(Promise.reject({ code: 'functions/unavailable' }), Promise.resolve({ data: { text: 'ok' } }));
    expect(await service.generateContent('prompt')).toBe('ok');
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.calls.mostRecent().args[0]).toEqual({ prompt: 'prompt', model: 'gemini-2.5-flash', isJson: true });
  });
  it('marks workout generation explicitly so server catalog restrictions apply', async () => {
    request.and.resolveTo({ data: { text: '[]' } });
    expect(await service.generateWorkoutContent('Mi semana')).toBe('[]');
    expect(request.calls.mostRecent().args[0]).toEqual({ prompt: 'Mi semana',
      model: 'gemini-2.5-flash', isJson: true, purpose: 'workout' });
  });
  it('does not repeat provider rotation, quota errors or denied requests', async () => {
    for (const failure of [{ code: 'functions/unavailable', details: { providerAttemptsComplete: true } },
      { code: 'functions/resource-exhausted' }, { code: 'functions/permission-denied' }]) {
      request.calls.reset();
      request.and.rejectWith(failure);
      await expectAsync(service.generateContent('prompt')).toBeRejectedWith(failure);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it('bounds transport retries and rejects empty responses', async () => {
    request.and.rejectWith({ code: 'functions/unavailable' });
    await expectAsync(service.generateContent('prompt')).toBeRejected();
    expect(request).toHaveBeenCalledTimes(2);
    request.calls.reset(); request.and.resolveTo({ data: {} });
    await expectAsync(service.generateContent('prompt')).toBeRejectedWithError('Respuesta de IA vacía');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('omits an empty attachment MIME type for text chat and preserves real attachments', async () => {
    request.and.resolveTo({ data: { text: 'Hola' } });
    const history = [{ role: 'user', parts: [{ text: 'contexto' }] }];
    await service.generateContent('Hola', false, undefined, '', history);
    expect(request.calls.mostRecent().args[0]).toEqual({ prompt: 'Hola', model: 'gemini-2.5-flash', isJson: false, history });
    await service.generateContent('Imagen', false, 'eA==', 'image/png');
    expect(request.calls.mostRecent().args[0].mimeType).toBe('image/png');
    request.calls.reset();
    await expectAsync(service.generateContent('Imagen', false, 'eA==')).toBeRejectedWithError('Indica el formato del archivo adjunto.');
    expect(request).not.toHaveBeenCalled();
  });
});
