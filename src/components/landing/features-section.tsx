import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Award, MonitorSmartphone, CheckCircle } from 'lucide-react'; // MonitorSmartphone is a good combined icon

const features = [
  {
    icon: <Zap className="h-8 w-8 text-accent" />,
    title: 'Fast and Free',
    description: 'Quickly remove backgrounds from your images at no cost. Perfect for quick edits and projects.',
  },
  {
    icon: <Award className="h-8 w-8 text-accent" />,
    title: 'High-Quality PNG Output',
    description: 'Download your images with clean, transparent backgrounds in high-resolution PNG format.',
  },
  {
    icon: <MonitorSmartphone className="h-8 w-8 text-accent" />,
    title: 'Works Anywhere',
    description: 'Accessible on both mobile and desktop devices, so you can edit images on the go or at your desk.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-[hsl(var(--card))]">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16 animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out">
          <h2 className="text-3xl md:text-4xl font-headline font-bold tracking-tight">Amazing Features</h2>
          <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
            Our tool is packed with features to make your life easier.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
             <div 
              key={feature.title} 
              className="animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <Card className="h-full shadow-lg hover:shadow-xl transition-shadow duration-300 bg-[hsl(var(--background))]">
                <CardHeader className="flex flex-row items-center gap-4">
                  {feature.icon}
                  <CardTitle className="font-headline text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
