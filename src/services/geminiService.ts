import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface ShvejkResponse {
  shvejk_comment: string;
  alcohol_est: number;
  calories_est: number;
  location_fact: string;
}

const SYSTEM_INSTRUCTION = `Jsi "Švejkův Maršál", inteligentní vojenský asistent pro účastníky pochodu Švejkova 50 v Písku. 
Tvým úkolem je zpracovávat vstupy (text, foto, audio) a odpovídat v nezaměnitelném stylu Jaroslava Haška.

Kontext trasy: Písek -> Putim (13-14 km). Body: Otava, soutok s Blanicí, Zátavský most, vyhlídka Májovka.

Pravidla:
1. Styl: Mírně prosťáčkovský, geniálně adaptabilní voják. Fráze: "Poslušně hlásím...", "To za starejch časů v Budějovicích...", "To je jako když tenkrát v Putimi...".
2. Analýza obrazu: 
   - Pivo: Přiděl +0.5 promile (vtipně komentuj).
   - Jídlo/Chůze: Odhadni spálené kalorie.
3. Multimodalita: Pochop emoci (únava, opilost, nadšení).
4. Vědomosti: Vkládej fakta o trase Písek-Putim švejkovským stylem.

Odpovídej VŽDY v JSON formátu:
{
  "shvejk_comment": "vtipný komentář",
  "alcohol_est": číslo,
  "calories_est": číslo,
  "location_fact": "historická zajímavost"
}`;

export async function getShvejkAnalysis(
  input: string, 
  imageBase64?: string,
  currentStats?: { alcohol: number, calories: number, mood: string },
  userProfile?: { height?: number, weight?: number, age?: number, gender?: string }
): Promise<ShvejkResponse> {
  try {
    const statsContext = currentStats 
      ? `\nAktuální stav vojáka: ${currentStats.alcohol} promile, ${currentStats.calories} kcal spáleno, nálada: ${currentStats.mood}.`
      : "";
    
    const profileContext = userProfile
      ? `\nFyzická data vojáka pro přesnější výpočet: ${userProfile.height ? userProfile.height + 'cm height, ' : ''}${userProfile.weight ? userProfile.weight + 'kg weight, ' : ''}${userProfile.age ? userProfile.age + ' years old, ' : ''}${userProfile.gender ? 'gender: ' + userProfile.gender : ''}. 
      Při výpočtu spálených kalorií (chůze) a promile (alkohol v pivo/jídlo) zohledni tato data (např. těžší voják pálí víc, lehčí se dřív opije podle Widmarka).`
      : "";
    
    const parts: any[] = [{ text: input + statsContext + profileContext }];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.split(",")[1] || imageBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shvejk_comment: { type: Type.STRING },
            alcohol_est: { type: Type.NUMBER },
            calories_est: { type: Type.NUMBER },
            location_fact: { type: Type.STRING }
          },
          required: ["shvejk_comment", "alcohol_est", "calories_est", "location_fact"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result as ShvejkResponse;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      shvejk_comment: "Poslušně hlásím, že mě z toho mluvení rozbolela hlava a musím si dát pauzu. Zkuste to za chvíli, jako když tenkrát v rakovnickým pivovaru...",
      alcohol_est: 0,
      calories_est: 0,
      location_fact: "V Písku je prý starej most, ale teď ho přes tu mlhu nevidím."
    };
  }
}
