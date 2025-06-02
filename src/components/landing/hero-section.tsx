import ImageProcessor from '@/components/image-processor';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section 
      id="upload-section" 
      className="w-full py-20 md:py-32 bg-gradient-to-br from-primary to-accent text-primary-foreground animate-in fade-in-0 duration-1000 ease-out"
    >
      <div className="container mx-auto px-4 md:px-6 text-center">
        <div 
          className="max-w-3xl mx-auto space-y-6 animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out delay-200"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold tracking-tight">
            Remove Image Backgrounds Instantly
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/90">
            Upload an image and get a clean, transparent background in seconds — powered by AI.
          </p>
        </div>
        <div className="mt-12 md:mt-16">
          <ImageProcessor />
        </div>
      </div>
    </section>
  );
}
