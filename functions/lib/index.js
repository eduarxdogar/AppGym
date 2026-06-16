"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGemini = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const generative_ai_1 = require("@google/generative-ai");
exports.callGemini = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 10,
    concurrency: 80,
}, async (request) => {
    // 1. Validate Authentication
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado para usar la IA.");
    }
    // 2. Extract payload
    const data = request.data;
    const prompt = data.prompt;
    const modelName = data.model;
    const isJson = data.isJson;
    if (!prompt || !modelName) {
        throw new https_1.HttpsError("invalid-argument", "Faltan argumentos requeridos (prompt o model).");
    }
    // 3. Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        logger.error("No se encontró GEMINI_API_KEY en el entorno.");
        throw new https_1.HttpsError("internal", "Configuración de servidor incompleta.");
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: isJson ? { responseMimeType: "application/json" } : undefined,
    });
    try {
        // 4. Call Gemini
        let result;
        if (data.history && data.history.length > 0) {
            const chat = model.startChat({ history: data.history });
            if (data.imageBase64 && data.mimeType) {
                const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
                result = await chat.sendMessage([data.prompt, imagePart]);
            }
            else {
                result = await chat.sendMessage(data.prompt);
            }
        }
        else {
            if (data.imageBase64 && data.mimeType) {
                const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
                result = await model.generateContent([data.prompt, imagePart]);
            }
            else {
                result = await model.generateContent(data.prompt);
            }
        }
        return { text: result.response.text() };
    }
    catch (error) {
        logger.error("Gemini Error:", error);
        console.error("Detalle del error de Gemini:", error);
        // Check if it's a quota/rate limit error (429)
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            throw new https_1.HttpsError('resource-exhausted', 'Límite de cuota excedido temporalmente.');
        }
        throw new https_1.HttpsError("internal", "Error interno procesando el documento.");
    }
});
//# sourceMappingURL=index.js.map