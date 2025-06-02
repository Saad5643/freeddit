'use server';
/**
 * @fileOverview Provides background prompt suggestions for the image background remover tool.
 *
 * - suggestBackgroundPrompts - A function that suggests background prompts.
 * - SuggestBackgroundPromptsInput - The input type for the suggestBackgroundPrompts function.
 * - SuggestBackgroundPromptsOutput - The return type for the suggestBackgroundPrompts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestBackgroundPromptsInputSchema = z.object({
  imageDescription: z
    .string()
    .describe('Description of the image whose background will be replaced.'),
});
export type SuggestBackgroundPromptsInput = z.infer<
  typeof SuggestBackgroundPromptsInputSchema
>;

const SuggestBackgroundPromptsOutputSchema = z.object({
  prompts: z
    .array(z.string())
    .describe('An array of suggested background prompts.'),
});
export type SuggestBackgroundPromptsOutput = z.infer<
  typeof SuggestBackgroundPromptsOutputSchema
>;

export async function suggestBackgroundPrompts(
  input: SuggestBackgroundPromptsInput
): Promise<SuggestBackgroundPromptsOutput> {
  return suggestBackgroundPromptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestBackgroundPromptsPrompt',
  input: {schema: SuggestBackgroundPromptsInputSchema},
  output: {schema: SuggestBackgroundPromptsOutputSchema},
  prompt: `Given the following description of an image, suggest 3 background prompts that could be used to replace the background of the image.

Image Description: {{{imageDescription}}}

Return the prompts as a JSON array of strings.  Do not provide any other text in the response. Do not include any explanation or intro or closing.

Example:
["beach", "forest", "office"]
`,
});

const suggestBackgroundPromptsFlow = ai.defineFlow(
  {
    name: 'suggestBackgroundPromptsFlow',
    inputSchema: SuggestBackgroundPromptsInputSchema,
    outputSchema: SuggestBackgroundPromptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
