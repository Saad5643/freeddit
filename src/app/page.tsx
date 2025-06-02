
import HeroSection from '@/components/landing/hero-section';
import HowItWorksSection from '@/components/landing/how-it-works-section';
import FeaturesSection from '@/components/landing/features-section';
import CtaSection from '@/components/landing/cta-section';
import FooterSection from '@/components/landing/footer-section';
import { SplashCursorDemo } from '@/components/splash-cursor-demo';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-background">
      <SplashCursorDemo />
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}

    