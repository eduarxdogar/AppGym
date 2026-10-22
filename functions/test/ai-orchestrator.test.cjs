const { test } = require('node:test');
const assert = require('node:assert/strict');
const { orchestrateAi, AiUnavailableError, AI_ATTEMPT_TIMEOUT_MS } = require('../lib/ai-orchestrator');
const credentials = { openai: 'test-openai', deepseek: 'test-deepseek', gemini: ['test-gemini'] };
const chat = (text = 'ok', finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason, message: { content: text } }] }));
const gemini = (text = 'ok', finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }));
const options = (fetch, extra = {}) => ({ keys: credentials, fetch, warn: () => {}, ...extra });

test('OpenAI is primary and success never contacts a fallback', async () => {
  let calls = 0;
  assert.equal(await orchestrateAi('hola', {}, options(async (url, request) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(request.headers.Authorization, 'Bearer test-openai');
    assert.equal(JSON.parse(request.body).model, 'gpt-4.1-mini');
    assert.equal(JSON.parse(request.body).store, false);
    return chat();
  })), 'ok');
  assert.equal(calls, 1);
  assert.equal(AI_ATTEMPT_TIMEOUT_MS, 10_000);
});

for (const status of [400, 401, 429, 500, 503]) {
  test(`OpenAI HTTP ${status} immediately delegates to DeepSeek`, async () => {
    const calls = [], warnings = [];
    assert.equal(await orchestrateAi('hola', {}, options(async (url, request) => {
      calls.push(url);
      if (calls.length === 1) return new Response('private upstream message', { status });
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(request.headers.Authorization, 'Bearer test-deepseek');
      assert.equal(JSON.parse(request.body).thinking.type, 'disabled');
      return chat('respuesta DeepSeek');
    }, { warn: (...args) => warnings.push(args) })), 'respuesta DeepSeek');
    assert.equal(calls.length, 2);
    assert.deepEqual(warnings[0][1], { provider: 'OpenAI', status });
    assert.equal(JSON.stringify(warnings).includes('private'), false);
  });
}

test('all providers failing returns one controlled error without keys, prompt or upstream exceptions', async () => {
  const warnings = [], calls = [];
  await assert.rejects(orchestrateAi('private health prompt', {}, options(async url => {
    calls.push(url); throw new Error('secret-provider-key');
  }, { warn: (...args) => warnings.push(args) })), error => {
    assert.ok(error instanceof AiUnavailableError);
    assert.equal(error.status, 503);
    assert.equal(error.message.includes('secret'), false);
    return true;
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(warnings.map(item => item[1].provider), ['OpenAI', 'DeepSeek', 'Gemini']);
  assert.equal(JSON.stringify(warnings).includes('secret'), false);
  assert.equal(JSON.stringify(warnings).includes('private'), false);
});

test('timeout aborts OpenAI, bounds response-body reads and still delegates when an adapter ignores abort', async () => {
  for (const hangInBody of [false, true]) {
    let calls = 0, signal;
    const result = await orchestrateAi('hola', {}, options(async (_url, request) => {
      if (++calls > 1) { assert.equal(signal.aborted, true); return chat('fallback'); }
      signal = request.signal;
      if (hangInBody) return { ok: true, json: () => new Promise(() => {}) };
      return new Promise(() => {});
    }, { timeoutMs: 10 }));
    assert.equal(result, 'fallback'); assert.equal(calls, 2);
  }
});

test('Gemini follows both text providers and preserves system, history and JSON root arrays', async () => {
  let calls = 0;
  const text = await orchestrateAi('semana', { isJson: true, model: 'gemini-2.5-pro',
    systemInstruction: 'restricción', history: [{ role: 'model', parts: [{ text: 'anterior' }] }] }, options(async (url, request) => {
    const body = JSON.parse(request.body);
    if (++calls < 3) {
      assert.equal(body.messages[1].role, 'assistant');
      assert.equal(body.messages[1].content, 'anterior');
      assert.equal(body.response_format, undefined); // json_object would break weekly arrays.
      return new Response('', { status: 429 });
    }
    assert.ok(url.endsWith('/gemini-2.5-pro:generateContent'));
    assert.ok(body.systemInstruction.parts[0].text.includes('restricción'));
    assert.equal(body.contents[0].parts[0].text, 'anterior');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 128);
    return gemini('[{"nombre":"Semana"}]');
  }));
  assert.deepEqual(JSON.parse(text), [{ nombre: 'Semana' }]);
});

test('empty, truncated, refused and malformed JSON responses trigger fallback', async () => {
  for (const first of [() => chat(''), () => chat('{}', 'length'), () => chat('{}', 'content_filter'),
    () => new Response('{}'), () => chat('no es JSON')]) {
    let calls = 0;
    assert.equal(await orchestrateAi('JSON', { isJson: true }, options(async () => ++calls === 1 ? first() : chat('```json\n[]\n```'))), '[]');
    assert.equal(calls, 2);
  }
});

test('business validation runs inside fallback and may return catalog-normalized JSON', async () => {
  let calls = 0;
  assert.equal(await orchestrateAi('rutina', { isJson: true, validateOutput: text => {
    if (JSON.parse(text).invalid) throw new Error('not in catalog');
    return '{"normalized":true}';
  } }, options(async () => chat(++calls === 1 ? '{"invalid":true}' : '{}'))), '{"normalized":true}');
  assert.equal(calls, 2);
});

test('missing credentials are skipped without network calls; Gemini rotates unique keys within one deadline', async () => {
  const calls = [];
  assert.equal(await orchestrateAi('hola', {}, options(async (url, request) => {
    calls.push(request.headers['x-goog-api-key']);
    assert.equal(url.includes('key'), false);
    return calls.length === 1 ? new Response('', { status: 429 }) : gemini('tercero');
  }, { keys: { gemini: [undefined, 'same', 'same', 'other'] } })), 'tercero');
  assert.deepEqual(calls, ['same', 'other']);
  await assert.rejects(orchestrateAi('hola', {}, options(async () => { throw new Error('should not call'); }, { keys: {} })), AiUnavailableError);
});

test('Gemini rejects blocked, truncated, missing and empty content; permanent errors do not rotate keys', async () => {
  for (const response of [() => gemini('x', 'MAX_TOKENS'), () => gemini('x', 'SAFETY'), () => gemini(''),
    () => new Response('{}'), () => new Response('', { status: 400 })]) {
    let calls = 0;
    await assert.rejects(orchestrateAi('hola', {}, options(async () => { calls++; return response(); },
      { keys: { gemini: ['first', 'second'] } })), AiUnavailableError);
    assert.equal(calls, 1);
  }
});

test('Gemini excludes thought parts and plain chat has no JSON constraint', async () => {
  assert.equal(await orchestrateAi('hola', {}, options(async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.systemInstruction, undefined);
    assert.equal(body.generationConfig.responseMimeType, undefined);
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: 'private' }, { text: 'visible' }] } }] }));
  }, { keys: { gemini: ['only'] } })), 'visible');
});

test('invalid prompts and timeout overrides are rejected before network access', async () => {
  for (const prompt of ['', null, 'a'.repeat(96 * 1024 + 1)]) await assert.rejects(orchestrateAi(prompt));
  for (const timeoutMs of [0, -1, 10_001, NaN]) await assert.rejects(orchestrateAi('hola', {}, { timeoutMs }));
});

test('public single-argument API reads credentials at invocation time', async () => {
  const prior = process.env.OPENAI_API_KEY, originalFetch = globalThis.fetch;
  try {
    process.env.OPENAI_API_KEY = 'runtime-test-key';
    globalThis.fetch = async (_url, request) => {
      assert.equal(request.headers.Authorization, 'Bearer runtime-test-key'); return chat('runtime');
    };
    assert.equal(await orchestrateAi('hola'), 'runtime');
  } finally {
    globalThis.fetch = originalFetch;
    if (prior === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prior;
  }
});
