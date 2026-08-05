"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatAI = exports.analyzeNutritionLabelAI = exports.generateNutritionPlanAI = exports.analyzeInbodyAI = exports.generateBoxingPlanAI = exports.generateWorkoutPlanAI = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const generative_ai_1 = require("@google/generative-ai");
const workout_prompt_1 = require("./prompts/workout.prompt");
const nutrition_prompt_1 = require("./prompts/nutrition.prompt");
const inbody_prompt_1 = require("./prompts/inbody.prompt");
const chat_prompt_1 = require("./prompts/chat.prompt");
const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        logger.error("No se encontró GEMINI_API_KEY en el entorno.");
        throw new https_1.HttpsError("internal", "Configuración de servidor incompleta.");
    }
    return new generative_ai_1.GoogleGenerativeAI(apiKey);
};
const handleGeminiError = (error) => {
    logger.error("Gemini Error:", error);
    console.error("Detalle del error de Gemini:", error);
    if (error.status === 429 || error.message?.includes('429')) {
        throw new https_1.HttpsError('resource-exhausted', 'AI_QUOTA_EXCEEDED');
    }
    if (error.name === 'SyntaxError' || error.message?.includes('JSON')) {
        throw new https_1.HttpsError('invalid-argument', 'AI_VALIDATION_FAILED');
    }
    if (error.status === 503 || error.message?.includes('503')) {
        throw new https_1.HttpsError('unavailable', 'AI_SERVICE_DOWN');
    }
    throw new https_1.HttpsError("internal", "Error interno procesando la solicitud de IA.");
};
const defaultOptions = {
    cors: true,
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 10,
    concurrency: 80,
};
exports.generateWorkoutPlanAI = (0, https_1.onCall)(defaultOptions, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado.");
    const data = request.data;
    if (!data.prompt)
        throw new https_1.HttpsError("invalid-argument", "Falta el prompt.");
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
            model: data.model || 'gemini-2.5-flash',
            systemInstruction: { role: 'system', parts: [{ text: workout_prompt_1.WORKOUT_SYSTEM_PROMPT }] },
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(data.prompt);
        return { text: result.response.text() };
    }
    catch (error) {
        return handleGeminiError(error);
    }
});
exports.generateBoxingPlanAI = (0, https_1.onCall)(defaultOptions, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado.");
    const data = request.data;
    if (!data.prompt)
        throw new https_1.HttpsError("invalid-argument", "Falta el prompt.");
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
            model: data.model || 'gemini-2.5-flash',
            systemInstruction: { role: 'system', parts: [{ text: workout_prompt_1.BOXING_SYSTEM_PROMPT }] },
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(data.prompt);
        return { text: result.response.text() };
    }
    catch (error) {
        return handleGeminiError(error);
    }
});
exports.analyzeInbodyAI = (0, https_1.onCall)(defaultOptions, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado.");
    const data = request.data;
    if (!data.prompt || !data.imageBase64 || !data.mimeType) {
        throw new https_1.HttpsError("invalid-argument", "Faltan argumentos (prompt o imagen).");
    }
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
            model: data.model || 'gemini-2.5-flash',
            systemInstruction: { role: 'system', parts: [{ text: inbody_prompt_1.INBODY_SYSTEM_PROMPT }] },
            generationConfig: { responseMimeType: "application/json" }
        });
        const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
        const result = await model.generateContent([data.prompt, imagePart]);
        return { text: result.response.text() };
    }
    catch (error) {
        return handleGeminiError(error);
    }
});
exports.generateNutritionPlanAI = (0, https_1.onCall)(defaultOptions, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado.");
    const data = request.data;
    if (!data.prompt)
        throw new https_1.HttpsError("invalid-argument", "Falta el prompt.");
    let systemPrompt = nutrition_prompt_1.NUTRITION_SYSTEM_PROMPT;
    if (data.useSeelegSupplements) {
        systemPrompt += `\nINTEGRACIÓN SEELEG (activada por el usuario):
El usuario ha optado por recibir recomendaciones de suplementación Seeleg.
Genera exactamente UNA comida (preferiblemente un Snack o Post-Entreno) como
una preparación detallada que utilice suplementos de la marca Seeleg
(ej. "Batido Post-Entreno Seeleg Whey", "Avena con Seeleg Isolate", etc.).
Para ESA comida específica y solo esa, agrega en el JSON los campos:
  "isSponsored": true,
  "sponsorBrand": "Seeleg"
El resto de las comidas NO deben tener esos campos.`;
    }
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
            model: data.model || 'gemini-2.5-flash',
            systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(data.prompt);
        return { text: result.response.text() };
    }
    catch (error) {
        return handleGeminiError(error);
    }
});
exports.analyzeNutritionLabelAI = (0, https_1.onCall)(defaultOptions, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado.");
    const data = request.data;
    if (!data.prompt || !data.imageBase64 || !data.mimeType) {
        throw new https_1.HttpsError("invalid-argument", "Faltan argumentos (prompt o imagen).");
    }
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
            model: data.model || 'gemini-2.5-flash',
            systemInstruction: { role: 'system', parts: [{ text: nutrition_prompt_1.NUTRITION_LABEL_SYSTEM_PROMPT }] },
            generationConfig: { responseMimeType: "application/json" }
        });
        const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
        const result = await model.generateContent([data.prompt, imagePart]);
        return { text: result.response.text() };
    }
    catch (error) {
        return handleGeminiError(error);
    }
});
exports.chatAI = (0, https_1.onCall)(defaultOptions, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "El usuario debe estar autenticado.");
    const data = request.data;
    if (!data.prompt)
        throw new https_1.HttpsError("invalid-argument", "Falta el prompt.");
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
            model: data.model || 'gemini-2.5-flash',
            systemInstruction: { role: 'system', parts: [{ text: chat_prompt_1.CHAT_SYSTEM_PROMPT }] }
        });
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
        else if (data.imageBase64 && data.mimeType) {
            const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
            result = await model.generateContent([data.prompt, imagePart]);
        }
        else {
            result = await model.generateContent(data.prompt);
        }
        return { text: result.response.text() };
    }
    catch (error) {
        return handleGeminiError(error);
    }
});
//# sourceMappingURL=ai.js.map