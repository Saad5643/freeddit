import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CtaSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6 text-center animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out">
        <h2 className="text-3xl md:text-4xl font-headline font-bold tracking-tight">
          Ready to Clear Up Your Images?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
          Stop struggling with complex editing software. Get crisp, transparent backgrounds in just a few clicks.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground px-10 py-6 text-lg">
            <Link href="#upload-section">Try Background Be Gone Now</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Currently free for everyone. Pro version with more features coming soon!
        </p>
      </div>
    </section>
  );
}
