import { GoogleGenerativeAI } from "@google/generative-ai";

// Tuto službu lze v budoucnu napojit na procesy v App.tsx
// pro real-time analýzu polních hlášení.

export const generateIntelligenceReport = async (messages: any[], location: string) => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("AI Orchestrátor: Chybí klíč, vracím standardní depeši.");
    return null;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Jsi vojenský zpravodaj rakousko-uherské armády v roce 1914. 
  Analyzuj tato hlášení z regionu ${location}: ${JSON.stringify(messages.slice(-5))}
  Vytvoř krátký "Polní zpravodaj" (max 3 věty) o lokální fauně, flóře nebo strategické situaci. 
  Piš v dobovém švejkovském stylu.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("AI selhala:", error);
    return null;
  }
};
