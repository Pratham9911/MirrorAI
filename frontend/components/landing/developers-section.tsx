"use client";

import { useState, useEffect, useRef } from "react";

const features = [
  {
    title: "Multi-Agent Intelligence",
    description: "Specialized agents monitor, analyze, and generate insights together."
  },
  {
    title: "Live Streaming Preview",
    description: "Watch your agents detect changes and generate insights in real-time."
  },
  {
    title: "Workflow Automation",
    description: "Automate monitoring, analysis, and reporting with custom workflows."
  },
  {
    title: "Seamless Integrations",
    description: "Send insights directly to email, Notion, or your existing tools."
  },
];

export function DevelopersSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLSection>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="developers" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">

      {/* Image — absolute, bottom-right, behind all content */}
      <div
        className={`absolute bottom-0 right-0 w-[55%] h-[85%] pointer-events-none transition-all duration-1000 delay-300 ${isVisible ? "opacity-100" : "opacity-0"
          }`}
      >
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Upscaled%20Image%20%2813%29-OQ2DiR3ElVsUg8kTvTL1kC5A3Q6maM.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-left-top"
        />
        {/* Fade left edge */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        {/* Fade top edge */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent" />
      </div>

      {/* All text content sits on top */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header — Full width */}
        <div
          className={`mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Insight Engine
          </span>
          <h2 className="text-5xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9]">
            Cook your agents.
            <br />
            <span className="text-muted-foreground">Or let them cook.</span>
          </h2>
        </div>

        {/* Description + Features — left half only */}
        <div
          className={`w-full lg:max-w-[50%] transition-all duration-700 delay-100 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
        >
          <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-md">
            An intelligent system of AI agents that monitors competitors, analyzes changes, and delivers actionable insights.
            Set your goals — let the agents do the work.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`transition-all duration-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                style={{ transitionDelay: `${index * 50 + 200}ms` }}
              >
                <h3 className="font-medium mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
