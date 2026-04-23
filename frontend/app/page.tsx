"use client";

import { useEffect } from "react";
import { BACKEND_URL } from "@/lib/config";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { InfrastructureSection } from "@/components/landing/infrastructure-section";
import { MetricsSection } from "@/components/landing/metrics-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { SecuritySection } from "@/components/landing/security-section";
import { DevelopersSection } from "@/components/landing/developers-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

export default function Home() {
  useEffect(() => {
    // Ping the backend to wake it up if it's sleeping (Render free tier)
    fetch(`${BACKEND_URL}/health`).catch(() => {
      // Ignore errors, we just want to signal the server
    })
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <IntegrationsSection />
      <SecuritySection />
      <PricingSection />
      <DevelopersSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
