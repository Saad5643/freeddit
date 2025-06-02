
'use server';

/**
 * @fileOverview AI agent that generates a new background for an image based on a text prompt,
 * or removes the background using an external service.
 *
 * - generateNewBackground - A function that handles the image background generation/removal process.
 * - GenerateNewBackgroundInput - The input type for the generateNewBackground function.
 * - GenerateNewBackgroundOutput - The return type for the generateNewBackground function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { removeBackgroundFromImageBase64, type RemoveBgResult, type RemoveBgError } from 'remove.bg';
import { Buffer } from 'buffer';

const GenerateNewBackgroundInputSchema = z.object({
  image: z
    .string()
    .describe(
      "The input image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('The text prompt describing the desired background or action. This is ignored when using Remove.bg API.'),
});
export type GenerateNewBackgroundInput = z.infer<typeof GenerateNewBackgroundInputSchema>;

const GenerateNewBackgroundOutputSchema = z.object({
  newImage: z
    .string()
    .describe('The image with the new background, as a data URI.'),
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
    const apiKey = process.env.EXTERNAL_BACKGROUND_REMOVAL_API_KEY;

    if (!apiKey) {
      console.error('Remove.bg API key is missing (EXTERNAL_BACKGROUND_REMOVAL_API_KEY).');
      throw new Error('Background removal service is not configured. API key missing.');
    }

    if (!input.image || !input.image.includes(';base64,')) {
      console.error('Invalid image data URI format provided.');
      throw new Error('Invalid image data URI format. Expected format: data:<mimetype>;base64,<encoded_data>');
    }
    
    const base64Data = input.image.split(',')[1];
    if (!base64Data) {
      console.error('Could not extract base64 data from image URI.');
      throw new Error('Invalid image data URI: could not extract base64 data.');
    }

    try {
      const result: RemoveBgResult = await removeBackgroundFromImageBase64({
        base64img: base64Data,
        apiKey: apiKey,
        format: 'png', // Ensures PNG output, good for transparency
        // Add other options like size: 'regular', type: 'person' if needed
      });

      if (result.base64img) {
        return {
          newImage: `data:image/png;base64,${result.base64img}`,
        };
      } else {
        console.error('Remove.bg API did not return image data.');
        throw new Error('Background removal service did not return an image.');
      }
    } catch (error: any) {
      console.error('Error calling Remove.bg API:', error);
      let errorMessage = 'Failed to process image with Remove.bg.';
      if (error.errors && Array.isArray(error.errors)) {
        errorMessage += ` Details: ${error.errors.map((e: RemoveBgError) => e.title).join(', ')}`;
      } else if (error.message) {
        errorMessage += ` Details: ${error.message}`;
      }
      throw new Error(errorMessage);
    }
  }
);

