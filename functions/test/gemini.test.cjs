const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateWithFallback, parseGeminiPayload, GeminiError, GEMINI_LIMITS } = require('../lib/gemini');
const payload = { prompt: 'test', model: 'gemini-2.5-flash', isJson: true };
const success = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
test('rotates first, second and third keys after quota and saturation with bounded backoff', async () => {
  const keys = [], delays = [];
  const output = await generateWithFallback(payload, ['first', 'second', 'third'], {
    sleep: async ms => { delays.push(ms); },
    fetch: async (_url, request) => {
      keys.push(request.headers['x-goog-api-key']);
      return keys.length === 1 ? new Response('', { status: 429 }) : keys.length === 2 ? new Response('', { status: 503 }) : success();
    },
  });
  assert.equal(output, 'ok');
  assert.deepEqual(keys, ['first', 'second', 'third']);
  assert.deepEqual(delays, [250, 500]);
});
test('timeouts actually abort the request before using next key', async () => {
  let calls = 0, aborted = false;
  const result = await generateWithFallback(payload, ['first', 'second'], {
    timeoutMs: 5, sleep: async () => {}, fetch: async (_url, request) => {
      if (++calls > 1) return success();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(success()), 100);
        request.signal.addEventListener('abort', () => {
          clearTimeout(timer); aborted = true; reject(request.signal.reason);
        });
      });
    },
  });
  assert.equal(result, 'ok'); assert.equal(aborted, true); assert.equal(calls, 2);
});
test('permanent errors do not rotate and exhausted keys terminate after three calls', async () => {
  let calls = 0;
  await assert.rejects(generateWithFallback(payload, ['first', 'second'], { fetch: async () => {
    calls++; return new Response('', { status: 400 });
  } }), error => error instanceof GeminiError && error.status === 400);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(generateWithFallback(payload, ['first', 'second', 'third'], { sleep: async () => {}, fetch: async () => {
    calls++; return new Response('', { status: 429 });
  } }), error => error.status === 429);
  assert.equal(calls, 3);
});
test('missing and duplicate keys are skipped; multimodal history and JSON settings survive fallback', async () => {
  let calls = 0;
  const request = { ...payload, imageBase64: 'aGVsbG8=', mimeType: 'image/png', history: [{ role: 'user', parts: [{ text: 'earlier' }] }] };
  await generateWithFallback(request, [undefined, 'same', 'same'], { fetch: async (url, options) => {
    calls++;
    assert.equal(url.includes('same'), false);
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].text, 'earlier');
    assert.equal(body.contents[1].parts[1].inlineData.mimeType, 'image/png');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    return success();
  } });
  assert.equal(calls, 1);
  await assert.rejects(generateWithFallback(payload, []), error => error.status === 503);
});
test('rejects untrusted models and malformed history; empty/safety response is not retried', async () => {
  for (const input of [null, { ...payload, model: '../bad' }, { ...payload, prompt: '' }, { ...payload, history: [null] }]) {
    assert.throws(() => parseGeminiPayload(input));
  }
  assert.deepEqual(parseGeminiPayload(payload), payload);
  await assert.rejects(generateWithFallback(payload, ['first', 'second'], { fetch: async () => new Response('{}') }), error => error.status === 422);
});

test('enforces UTF-8 prompt, aggregate history and total text budgets', () => {
  assert.equal(parseGeminiPayload({ ...payload, prompt: 'a'.repeat(GEMINI_LIMITS.promptBytes) }).prompt.length, GEMINI_LIMITS.promptBytes);
  assert.throws(() => parseGeminiPayload({ ...payload, prompt: 'a'.repeat(GEMINI_LIMITS.promptBytes + 1) }));
  assert.throws(() => parseGeminiPayload({ ...payload, prompt: '💪'.repeat(GEMINI_LIMITS.promptBytes / 4 + 1) }));
  const history = [ { role: 'user', parts: [{ text: 'a'.repeat(70_000) }] },
    { role: 'model', parts: [{ text: 'b'.repeat(70_000) }] } ];
  assert.throws(() => parseGeminiPayload({ ...payload, history }));
  assert.throws(() => parseGeminiPayload({ ...payload, prompt: 'a'.repeat(64_000),
    history: [{ role: 'user', parts: [{ text: 'b'.repeat(110_000) }] }] }));
});
test('rejects oversized message counts, malformed media and unrecognized payload fields', () => {
  for (const extra of [{ userId: 'victim' }, { useSeelegSupplements: 'true' }, { mimeType: 'image/png' },
    { imageBase64: '!!!=', mimeType: 'image/png' }, { imageBase64: 'aGVsbG8=', mimeType: 'text/html' },
    { imageBase64: 'a'.repeat(GEMINI_LIMITS.imageBase64Bytes + 4), mimeType: 'image/png' },
    { history: Array.from({ length: GEMINI_LIMITS.historyMessages + 1 }, () => ({ role: 'user', parts: [{ text: 'a' }] })) },
    { history: [{ role: 'user', parts: [] }] }, { history: [{ role: 'user', parts: [{ text: 'hello', fileData: {} }] }] }]) {
    assert.throws(() => parseGeminiPayload({ ...payload, ...extra }));
  }
});

test('bounds reasoning for both supported models while allowing complete large plans and plain chat', async () => {
  for (const model of ['gemini-2.5-flash', 'gemini-2.5-pro']) {
    for (const isJson of [true, false]) {
      await generateWithFallback({ ...payload, model, isJson }, ['first'], { fetch: async (_url, request) => {
        const config = JSON.parse(request.body).generationConfig;
        assert.equal(config.thinkingConfig.thinkingBudget, 1024);
        assert.equal(config.maxOutputTokens, 16_384);
        assert.equal(config.responseMimeType, isJson ? 'application/json' : undefined);
        return success();
      } });
    }
  }
});

test('ignores thought summaries and rejects truncated output before clients parse incomplete JSON', async () => {
  const result = await generateWithFallback(payload, ['first'], { fetch: async () => new Response(JSON.stringify({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'private reasoning' }, { text: '{"ok":true}' }] } }],
  })) });
  assert.equal(result, '{"ok":true}');
  await assert.rejects(generateWithFallback(payload, ['first'], { fetch: async () => new Response(JSON.stringify({
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"partial":' }] } }],
  })) }), error => error.status === 422);
});
