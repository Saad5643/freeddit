import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, Wand2, DownloadCloud, StepForward } from 'lucide-react';

const steps = [
  {
    icon: <UploadCloud className="h-10 w-10 text-primary mb-4" />,
    title: '1. Upload Your Image',
    description: 'Simply drag and drop your image or click to select a file from your device.',
  },
  {
    icon: <Wand2 className="h-10 w-10 text-primary mb-4" />,
    title: '2. AI Processes It',
    description: 'Our intelligent AI analyzes your image and automatically removes the background.',
  },
  {
    icon: <DownloadCloud className="h-10 w-10 text-primary mb-4" />,
    title: '3. Download Result',
    description: 'Get your high-quality image with a transparent background, ready to use.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16 animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out">
          <h2 className="text-3xl md:text-4xl font-headline font-bold tracking-tight">How It Works</h2>
          <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
            Getting a transparent background is as easy as 1-2-3.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div 
              key={step.title} 
              className="animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <Card className="text-center h-full shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  {step.icon}
                  <CardTitle className="font-headline text-xl">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
