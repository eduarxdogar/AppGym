import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface GeminiPayload {
  prompt: string;
  model: string;
  isJson: boolean;
  imageBase64?: string;
  mimeType?: string;
  history?: any[];
}

export const callGemini = onCall(async (request) => {
  // 1. Validate Authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado para usar la IA."
    );
  }

  // 2. Extract payload
  const data = request.data as GeminiPayload;
  const prompt = data.prompt;
  const modelName = data.model;
  const isJson = data.isJson;

  if (!prompt || !modelName) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan argumentos requeridos (prompt o model)."
    );
  }

  // 3. Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("No se encontró GEMINI_API_KEY en el entorno.");
    throw new HttpsError(
      "internal",
      "Configuración de servidor incompleta."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
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
        } else {
            result = await chat.sendMessage(data.prompt);
        }
    } else {
        if (data.imageBase64 && data.mimeType) {
            const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
            result = await model.generateContent([data.prompt, imagePart]);
        } else {
            result = await model.generateContent(data.prompt);
        }
    }
    
    return { text: result.response.text() };
  } catch (error: any) {
    logger.error("Error al llamar a Gemini:", error);
    throw new HttpsError("internal", error.message || "Error interno del servidor al contactar IA.");
  }
});
