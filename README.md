# Background Be Gone

Remove or replace image backgrounds with AI, in the browser. Free to use.

**Live demo:** https://backgroundbegone.vercel.app

## Features

- Drag-and-drop image upload
- AI background removal with a transparent PNG preview and download
- Generate a new background from a text prompt
- Prompt suggestions and image quality enhancement

## Tech stack

Next.js, TypeScript, Tailwind CSS, shadcn/ui, and [Genkit](https://firebase.google.com/docs/genkit) with Google Gemini (`gemini-2.0-flash`).

## Run it locally

```bash
git clone https://github.com/Saad5643/freeddit.git
cd freeddit
npm install
```

Create a `.env.local` file with your own Gemini API key (get one at https://aistudio.google.com/apikey):

```
GEMINI_API_KEY=your_key_here
```

Then start the dev server and open http://localhost:9002 (or the port Next.js prints):

```bash
npm run dev
```

## Project layout

- `src/app` — pages
- `src/components` — UI, including the image processor and landing sections
- `src/ai/flows` — Genkit flows: `generate-background`, `suggest-background-prompts`, `enhance-image-quality`

## Contributing

Issues and pull requests are welcome. For bigger changes, open an issue first so we can agree on the approach. Please run `npm run lint` and `npm run typecheck` before sending a PR.

## Licence

[MIT](LICENSE)
