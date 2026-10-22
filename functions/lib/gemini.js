"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_LIMITS = exports.GeminiError = void 0;
exports.parseGeminiPayload = parseGeminiPayload;
exports.generateWithFallback = generateWithFallback;
class GeminiError extends Error {
    status;
    constructor(status) {
        super(`Gemini request failed (${status})`);
        this.status = status;
    }
}
exports.GeminiError = GeminiError;
exports.GEMINI_LIMITS = {
    promptBytes: 64 * 1024,
    historyBytes: 128 * 1024,
    totalTextBytes: 160 * 1024,
    historyMessages: 100,
    partsPerMessage: 20,
    imageBase64Bytes: 10_000_000,
};
function parseGeminiPayload(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('Invalid payload');
    const allowed = ['prompt', 'model', 'isJson', 'imageBase64', 'mimeType', 'history', 'useSeelegSupplements', 'purpose'];
    if (Object.keys(input).some(key => !allowed.includes(key)))
        throw new Error('Unknown payload field');
    const data = input;
    if (typeof data.prompt !== 'string' || !data.prompt.trim()
        || Buffer.byteLength(data.prompt, 'utf8') > exports.GEMINI_LIMITS.promptBytes
        || !['gemini-2.5-flash', 'gemini-2.5-pro'].includes(data.model)
        || typeof data.isJson !== 'boolean'
        || (data.purpose !== undefined && data.purpose !== 'workout'))
        throw new Error('Invalid prompt or model');
    if ((data.imageBase64 === undefined) !== (data.mimeType === undefined)
        || (data.useSeelegSupplements !== undefined && typeof data.useSeelegSupplements !== 'boolean')) {
        throw new Error('Invalid optional field');
    }
    if (data.imageBase64 !== undefined && (typeof data.imageBase64 !== 'string' || !data.imageBase64
        || data.imageBase64.length > exports.GEMINI_LIMITS.imageBase64Bytes || data.imageBase64.length % 4 !== 0
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.imageBase64)
        || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(data.mimeType ?? ''))) {
        throw new Error('Invalid image');
    }
    if (data.history !== undefined && (!Array.isArray(data.history) || data.history.length > exports.GEMINI_LIMITS.historyMessages
        || data.history.some(item => !item || !['user', 'model'].includes(item.role)
            || Object.keys(item).some(key => !['role', 'parts'].includes(key))
            || !Array.isArray(item.parts) || !item.parts.length || item.parts.length > exports.GEMINI_LIMITS.partsPerMessage
            || item.parts.some(part => !part || typeof part.text !== 'string' || !part.text.trim()
                || Object.keys(part).some(key => key !== 'text'))))) {
        throw new Error('Invalid history');
    }
    const historyBytes = Buffer.byteLength(JSON.stringify(data.history ?? []), 'utf8');
    if (historyBytes > exports.GEMINI_LIMITS.historyBytes
        || historyBytes + Buffer.byteLength(data.prompt, 'utf8') > exports.GEMINI_LIMITS.totalTextBytes) {
        throw new Error('Text budget exceeded');
    }
    return {
        prompt: data.prompt, model: data.model, isJson: data.isJson,
        ...(data.imageBase64 !== undefined ? { imageBase64: data.imageBase64, mimeType: data.mimeType } : {}),
        ...(data.history ? { history: data.history.map(item => ({ role: item.role, parts: item.parts.map(part => ({ text: part.text })) })) } : {}),
        ...(data.useSeelegSupplements === true ? { useSeelegSupplements: true } : {}),
        ...(data.purpose ? { purpose: data.purpose } : {}),
    };
}
async function generateWithFallback(data, keys, options = {}) {
    const uniqueKeys = [...new Set(keys.map(key => key?.trim()).filter((key) => !!key))].slice(0, 3);
    if (!uniqueKeys.length)
        throw new GeminiError(503);
    const fetcher = options.fetch ?? fetch;
    const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const parts = [{ text: data.prompt }];
    if (data.imageBase64 && data.mimeType)
        parts.push({ inlineData: { data: data.imageBase64, mimeType: data.mimeType } });
    const body = JSON.stringify({
        contents: [...(data.history ?? []), { role: 'user', parts }],
        // Dynamic thinking can consume the entire attempt before a large plan is emitted.
        // Both supported 2.5 models accept this budget; leave room for the full JSON plan.
        generationConfig: {
            thinkingConfig: { thinkingBudget: 1024 },
            maxOutputTokens: 16_384,
            ...(data.isJson ? { responseMimeType: 'application/json' } : {}),
        },
    });
    let lastError = new GeminiError(503);
    for (let index = 0; index < uniqueKeys.length; index++) {
        if (index)
            await sleep(250 * 2 ** (index - 1));
        try {
            const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': uniqueKeys[index] },
                body,
                signal: AbortSignal.timeout(options.timeoutMs ?? 80_000),
            });
            if (!response.ok)
                throw new GeminiError(response.status);
            const result = await response.json();
            const candidate = result.candidates?.[0];
            if (candidate?.finishReason === 'MAX_TOKENS')
                throw new GeminiError(422);
            const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('');
            if (!text)
                throw new GeminiError(422);
            return text;
        }
        catch (error) {
            // Never log raw provider exceptions: some SDK errors contain the API key.
            lastError = error instanceof GeminiError ? error : new GeminiError(error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 504 : 503);
            if (![408, 429, 500, 502, 503, 504].includes(lastError.status))
                throw lastError;
        }
    }
    throw lastError;
}
//# sourceMappingURL=gemini.js.map