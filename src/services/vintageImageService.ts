import { GoogleGenAI } from "@google/genai";

/**
 * Služba pro historizaci obrázků pomocí Gemini AI.
 * Transformuje moderní fotografie do stylu rakousko-uherské éry (1914).
 */
export const historizeImage = async (base64Image: string): Promise<string | null> => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("AI Historizátor: Chybí API klíč.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Odstranění prefixu (data:image/jpeg;base64,...)
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const mimeType = base64Image.includes('image/png') ? 'image/png' : 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: 'Transform this image into a historical 1914-era Austro-Hungarian military field photograph. Style: Sepia-toned, heavy film grain, slightly blurred edges, aged parchment texture, authentic early 20th-century aesthetic. It should look like it was taken by a soldier during the Great War in South Bohemia.',
          },
        ],
      },
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Chyba při historizaci obrázku:", error);
    return null;
  }
};
