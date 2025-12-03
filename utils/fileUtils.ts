import { Part } from "@google/genai";

/**
 * Converts a File object to a GoogleGenerativeAI.Part object.
 * @param file The File object to convert.
 * @returns A promise that resolves to a Part object.
 */
export async function fileToGenerativePart(file: File): Promise<Part> {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const base64EncodedData = await base64EncodedDataPromise;

  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
}
