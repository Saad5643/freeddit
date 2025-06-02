
'use server';

/**
 * @fileOverview AI agent that generates a new background for an image based on a text prompt.
 *
 * - generateNewBackground - A function that handles the image background generation process.
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
  prompt: z.string().describe('The text prompt describing the desired background.'),
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
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // Explicitly use the image-generation capable model
      prompt: [
        {media: {url: input.image}}, // Use input.image from the flow's input
        {text: input.prompt}         // Use input.prompt from the flow's input
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // Crucial for getting image output
      },
    });

    if (!media?.url) {
      console.error('AI response missing media URL:', media);
      throw new Error('AI did not return an image. The media URL is missing.');
    }

    return {
      newImage: media.url,
    };
  }
);
