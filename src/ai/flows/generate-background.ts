
'use server';

/**
 * @fileOverview AI agent that generates a new background for an image based on a text prompt.
 *
 * - generateNewBackground - A function that handles the image background generation/removal process.
 * - GenerateNewBackgroundInput - The input type for the generateNewBackground function.
 * - GenerateNewBackgroundOutput - The return type for the generateNewBackground function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNewBackgroundInputSchema = z.object({
  image: z
    .string()
    .describe(
      "The input image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('The text prompt describing the desired action on the image.'),
});
export type GenerateNewBackgroundInput = z.infer<typeof GenerateNewBackgroundInputSchema>;

const GenerateNewBackgroundOutputSchema = z.object({
  newImage: z
    .string()
    .describe('The processed image, as a data URI.'),
});
export type GenerateNewBackgroundOutput = z.infer<typeof GenerateNewBackgroundOutputSchema>;

export async function generateNewBackground(
  input: GenerateNewBackgroundInput
): Promise<GenerateNewBackgroundOutput> {
  return generateNewBackgroundFlow(input);
}

const generateNewBackgroundFlow = ai.defineFlow(
  {
    name: 'generateNewBackgroundFlow',
    inputSchema: GenerateNewBackgroundInputSchema,
    outputSchema: GenerateNewBackgroundOutputSchema,
  },
  async (input: GenerateNewBackgroundInput) => {
    try {
      const systemInstruction = "SYSTEM COMMAND: You are an expert image editor. Your task is to isolate the main subject from the provided image. The output MUST be a PNG image. The background of this PNG, meaning all areas NOT part of the main subject, MUST be 100% transparent using a full alpha channel. It is CRITICAL that this background is NOT white, NOT any solid color, and NOT any pattern. Only the main subject should be visible, with true transparency elsewhere. Do not add watermarks or other artifacts.";
      const combinedPrompt = `${systemInstruction}\n\nUSER REQUEST: ${input.prompt}`;

      const {media, finishReason, unblockedSafetyRatings} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: [
          {media: {url: input.image}},
          {text: combinedPrompt},
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
           safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        },
      });

      const finishReasonUpper = finishReason?.toString().toUpperCase();
      if (finishReasonUpper !== 'STOP' && finishReasonUpper !== 'MODEL_COMPLETE' && finishReasonUpper !== 'FINISH_REASON_STOP') {
        console.error('AI generation finished for a non-STOP reason:', finishReason, unblockedSafetyRatings);
        throw new Error(`AI generation failed. Reason: ${finishReason}.`);
      }

      if (!media?.url) {
        console.error('AI did not return an image URL. Finish reason:', finishReason, unblockedSafetyRatings);
        throw new Error('AI did not return an image with a valid URL. Finish reason: ' + finishReason);
      }

      return { newImage: media.url };

    } catch (error: any) {
      console.error('Error in generateNewBackgroundFlow:', error);
      let errorMessage = 'Failed to generate new background using AI.';
      if (error && error.message) { 
        errorMessage += ` Details: ${error.message}`;
        const errorDetailsLower = JSON.stringify(error).toLowerCase();
         if (errorDetailsLower.includes('safety') || errorDetailsLower.includes('blocked') || (error.code && typeof error.code === 'string' && error.code.toLowerCase().includes('candidate_blocked'))) {
          errorMessage += ' The request may have been blocked by safety filters.';
        }
      } else {
        errorMessage += ' An unknown error occurred during AI processing.'
      }
      throw new Error(errorMessage);
    }
  }
);
