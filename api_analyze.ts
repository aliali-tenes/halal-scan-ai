import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { base64Data } = req.body;
  const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          status: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING },
          recommendation: { type: SchemaType.STRING }
        }
      }
    }
  });

  const result = await model.generateContent([
    { inlineData: { mimeType: "image/jpeg", data: base64Data } },
    { text: "هل المكونات في الصورة حلال أم حرام؟ (خنزير، كحول، مشتقات حيوانية غير مذكاة). أجب بالعربية." }
  ]);

  return res.status(200).json(JSON.parse(result.response.text()));
}