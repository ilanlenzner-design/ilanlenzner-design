import { GoogleGenAI, Part, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Uses a vision model to generate a text description of an image.
 * @param imagePart The image to describe, as a Generative Part.
 * @param promptText The text prompt to accompany the image.
 * @returns A promise that resolves to the text description.
 */
export async function describeImage(imagePart: Part, promptText: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [imagePart, { text: promptText }]
    },
  });

  return response.text;
}

/**
 * Expands an image by filling in transparent areas using a multimodal model.
 * @param imageBase64 The base64 encoded source image (with transparency).
 * @param prompt The text prompt to guide the expansion.
 * @returns A promise that resolves to the base64 encoded generated image string.
 */
export async function expandImage(imageBase64: string, prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/png',
          },
        },
        {
          text: prompt,
        },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  // Extract the image from the response
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }

  throw new Error("No image was generated in the response.");
}
