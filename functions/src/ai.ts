import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { WORKOUT_SYSTEM_PROMPT, BOXING_SYSTEM_PROMPT } from "./prompts/workout.prompt";
import { NUTRITION_SYSTEM_PROMPT, NUTRITION_LABEL_SYSTEM_PROMPT } from "./prompts/nutrition.prompt";
import { INBODY_SYSTEM_PROMPT } from "./prompts/inbody.prompt";
import { CHAT_SYSTEM_PROMPT } from "./prompts/chat.prompt";

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("No se encontró GEMINI_API_KEY en el entorno.");
    throw new HttpsError("internal", "Configuración de servidor incompleta.");
  }
  return new GoogleGenerativeAI(apiKey);
};

const handleGeminiError = (error: any): never => {
  logger.error("Gemini Error:", error);
  console.error("Detalle del error de Gemini:", error);
  
  if (error.status === 429 || error.message?.includes('429')) {
    throw new HttpsError('resource-exhausted', 'AI_QUOTA_EXCEEDED');
  }

  if (error.name === 'SyntaxError' || error.message?.includes('JSON')) {
     throw new HttpsError('invalid-argument', 'AI_VALIDATION_FAILED');
  }

  if (error.status === 503 || error.message?.includes('503')) {
    throw new HttpsError('unavailable', 'AI_SERVICE_DOWN');
  }
  
  throw new HttpsError("internal", "Error interno procesando la solicitud de IA.");
};

const defaultOptions = {
  cors: true,
  region: 'us-central1',
  timeoutSeconds: 300,
  memory: '512MiB' as const,
  maxInstances: 10,
  concurrency: 80,
};

export const generateWorkoutPlanAI = onCall(defaultOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "El usuario debe estar autenticado.");
  const data = request.data;
  if (!data.prompt) throw new HttpsError("invalid-argument", "Falta el prompt.");

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: data.model || 'gemini-2.5-flash',
      systemInstruction: { role: 'system', parts: [{ text: WORKOUT_SYSTEM_PROMPT }] },
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(data.prompt);
    return { text: result.response.text() };
  } catch (error) {
    return handleGeminiError(error);
  }
});

export const generateBoxingPlanAI = onCall(defaultOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "El usuario debe estar autenticado.");
  const data = request.data;
  if (!data.prompt) throw new HttpsError("invalid-argument", "Falta el prompt.");

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: data.model || 'gemini-2.5-flash',
      systemInstruction: { role: 'system', parts: [{ text: BOXING_SYSTEM_PROMPT }] },
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(data.prompt);
    return { text: result.response.text() };
  } catch (error) {
    return handleGeminiError(error);
  }
});

export const analyzeInbodyAI = onCall(defaultOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "El usuario debe estar autenticado.");
  const data = request.data;
  if (!data.prompt || !data.imageBase64 || !data.mimeType) {
    throw new HttpsError("invalid-argument", "Faltan argumentos (prompt o imagen).");
  }

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: data.model || 'gemini-2.5-flash',
      systemInstruction: { role: 'system', parts: [{ text: INBODY_SYSTEM_PROMPT }] },
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
    const result = await model.generateContent([data.prompt, imagePart]);
    return { text: result.response.text() };
  } catch (error) {
    return handleGeminiError(error);
  }
});

export const generateNutritionPlanAI = onCall(defaultOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "El usuario debe estar autenticado.");
  const data = request.data;
  if (!data.prompt) throw new HttpsError("invalid-argument", "Falta el prompt.");

  let systemPrompt = NUTRITION_SYSTEM_PROMPT;
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
  } catch (error) {
    return handleGeminiError(error);
  }
});

export const analyzeNutritionLabelAI = onCall(defaultOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "El usuario debe estar autenticado.");
  const data = request.data;
  if (!data.prompt || !data.imageBase64 || !data.mimeType) {
    throw new HttpsError("invalid-argument", "Faltan argumentos (prompt o imagen).");
  }

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: data.model || 'gemini-2.5-flash',
      systemInstruction: { role: 'system', parts: [{ text: NUTRITION_LABEL_SYSTEM_PROMPT }] },
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
    const result = await model.generateContent([data.prompt, imagePart]);
    return { text: result.response.text() };
  } catch (error) {
    return handleGeminiError(error);
  }
});

export const chatAI = onCall(defaultOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "El usuario debe estar autenticado.");
  const data = request.data;
  if (!data.prompt) throw new HttpsError("invalid-argument", "Falta el prompt.");

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: data.model || 'gemini-2.5-flash',
      systemInstruction: { role: 'system', parts: [{ text: CHAT_SYSTEM_PROMPT }] }
    });
    
    let result;
    if (data.history && data.history.length > 0) {
      const chat = model.startChat({ history: data.history });
      if (data.imageBase64 && data.mimeType) {
         const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
         result = await chat.sendMessage([data.prompt, imagePart]);
      } else {
         result = await chat.sendMessage(data.prompt);
      }
    } else if (data.imageBase64 && data.mimeType) {
       const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
       result = await model.generateContent([data.prompt, imagePart]);
    } else {
       result = await model.generateContent(data.prompt);
    }

    return { text: result.response.text() };
  } catch (error) {
    return handleGeminiError(error);
  }
});
