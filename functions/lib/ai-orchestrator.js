"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiUnavailableError = exports.AI_ATTEMPT_TIMEOUT_MS = void 0;
exports.orchestrateAi = orchestrateAi;
exports.AI_ATTEMPT_TIMEOUT_MS = 10_000;
class ProviderError extends Error {
    status;
    constructor(status) {
        super('AI provider attempt failed');
        this.status = status;
    }
}
class AiUnavailableError extends Error {
    status = 503;
    constructor() { super('No fue posible completar la solicitud de IA. Intenta nuevamente.'); }
}
exports.AiUnavailableError = AiUnavailableError;
async function withinDeadline(timeoutMs, run) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new ProviderError(504)); }, timeoutMs);
    });
    try {
        return await Promise.race([run(controller.signal), deadline]);
    }
    finally {
        clearTimeout(timer);
    }
}
/** Each node owns one bounded attempt and delegates only on failure. */
class ProviderHandler {
    provider;
    attempt;
    context;
    options;
    next;
    constructor(provider, attempt, context, options, next) {
        this.provider = provider;
        this.attempt = attempt;
        this.context = context;
        this.options = options;
        this.next = next;
    }
    async handle() {
        try {
            return await withinDeadline(this.options.timeoutMs ?? exports.AI_ATTEMPT_TIMEOUT_MS, async (signal) => {
                let text = (await this.attempt(signal)).trim();
                if (!text)
                    throw new ProviderError(422);
                if (this.context.isJson) {
                    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                    JSON.parse(text); // Both objects and root arrays are valid application contracts.
                }
                return this.context.validateOutput ? this.context.validateOutput(text) : text;
            });
        }
        catch (error) {
            // Raw SDK exceptions, prompts, API response bodies and credentials must never reach logs.
            (this.options.warn ?? console.warn)('AI provider failed; trying fallback', {
                provider: this.provider, status: error instanceof ProviderError ? error.status : 502,
            });
            if (this.next)
                return this.next.handle();
            throw new AiUnavailableError();
        }
    }
}
/** Public prompt -> Promise<string> API; credentials are resolved only at invocation time. */
async function orchestrateAi(prompt, context = {}, options = {}) {
    if (typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt) > 96 * 1024) {
        throw new Error('Invalid AI prompt');
    }
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0
        || options.timeoutMs > exports.AI_ATTEMPT_TIMEOUT_MS))
        throw new Error('Invalid AI timeout');
    const keys = options.keys ?? { openai: process.env.OPENAI_API_KEY, deepseek: process.env.DEEPSEEK_API_KEY,
        gemini: [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3] };
    const fetcher = options.fetch ?? fetch;
    const system = [context.systemInstruction, context.isJson
            ? 'Responde SOLO JSON válido, sin markdown. Conserva la estructura solicitada (objeto o array). Sé conciso.' : ''].filter(Boolean).join('\n');
    const messages = [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...(context.history ?? []).map(message => ({ role: message.role === 'model' ? 'assistant' : 'user',
            content: message.parts.map(part => part.text).join('\n') })),
        { role: 'user', content: prompt },
    ];
    const chatAttempt = (url, key, model, deepseek = false) => async (signal) => {
        if (!key?.trim())
            throw new ProviderError(503);
        const response = await fetcher(url, {
            method: 'POST', signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
            body: JSON.stringify({ model, messages, stream: false,
                ...(deepseek ? { max_tokens: 16_384, thinking: { type: 'disabled' } } : { max_completion_tokens: 16_384, store: false }) }),
        });
        if (!response.ok)
            throw new ProviderError(response.status);
        const result = await response.json();
        const choice = result.choices?.[0];
        if (choice?.finish_reason && choice.finish_reason !== 'stop')
            throw new ProviderError(422);
        if (typeof choice?.message?.content !== 'string')
            throw new ProviderError(422);
        return choice.message.content;
    };
    const geminiAttempt = async (signal) => {
        const uniqueKeys = [...new Set((keys.gemini ?? []).map(key => key?.trim()).filter((key) => !!key))].slice(0, 3);
        for (let index = 0; index < uniqueKeys.length; index++) {
            const model = context.model ?? 'gemini-2.5-flash';
            const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST', signal,
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': uniqueKeys[index] },
                body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
                    contents: [...(context.history ?? []), { role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 16_384, thinkingConfig: { thinkingBudget: model.endsWith('pro') ? 128 : 0 },
                        ...(context.isJson ? { responseMimeType: 'application/json' } : {}) } }),
            });
            if (!response.ok) {
                if (index < uniqueKeys.length - 1 && [408, 429, 500, 502, 503, 504].includes(response.status))
                    continue;
                throw new ProviderError(response.status);
            }
            const result = await response.json();
            const candidate = result.candidates?.[0];
            if (candidate?.finishReason && candidate.finishReason !== 'STOP')
                throw new ProviderError(422);
            return candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('') ?? '';
        }
        throw new ProviderError(503);
    };
    const gemini = new ProviderHandler('Gemini', geminiAttempt, context, options);
    const deepseek = new ProviderHandler('DeepSeek', chatAttempt('https://api.deepseek.com/chat/completions', keys.deepseek, 'deepseek-flash', true), context, options, gemini);
    return new ProviderHandler('OpenAI', chatAttempt('https://api.openai.com/v1/chat/completions', keys.openai, 'gpt-4.1-mini'), context, options, deepseek).handle();
}
//# sourceMappingURL=ai-orchestrator.js.map