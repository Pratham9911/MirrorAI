"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Check, Zap, X, Mail, MessageSquare, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BACKEND_URL } from "@/lib/config";

const plans = [
  {
    name: "Explorer",
    description: "For tinkering and individual research",
    price: { monthly: 0, annual: 0 },
    features: [
      "Daily 20 credit refill",
      "upto 2 competitors scan tracks",
      "Standard agent discovery",
      "Community log access",
      "Public data monitoring",
    ],
    cta: "Basic",
    highlight: false,
    type: "free"
  },
  {
    name: "Builder",
    description: "For professional market watchers",
    price: { monthly: 5, annual: 5 },
    features: [
      "All Explorer features included +",
      "5 concurrent scan tracks",
      "500 credits per month",
      "750 credit carry-over",
      "Internal tools integration",
      "Premium agent priorities",
    ],
    cta: "Contact via Mail",
    highlight: true,
    type: "pro"
  },
  {
    name: "Enterprise",
    description: "Tailored for high-frequency firms",
    price: { monthly: null, annual: null },
    features: [
      "Custom scan limits",
      "Custom credit packages",
      "Direct API integrations",
      "Dedicated account manager",
      "SLA & priority uptime",
      "On-prem deployment",
    ],
    cta: "Custom Requirements",
    highlight: false,
    type: "custom"
  },
];

export function PricingSection() {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    requirements: ""
  });
  const sectionRef = useRef<HTMLElement>(null);

  const handleCta = (plan: any) => {
    if (plan.type === "free") {
      router.push("/overview");
      return;
    }
    setOpenModal(plan.type);
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert("Please enter a valid work email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/upgrade-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: formData.email,
          plan_type: openModal === "pro" ? "Pro" : "Custom",
          message: formData.requirements
        })
      });
      const data = await resp.json();
      if (data.status === "success") {
        setSubmitted(true);
        setTimeout(() => {
          setOpenModal(null);
          setFormData({ email: "", requirements: "" });
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <section id="pricing" ref={sectionRef} className="relative py-32 lg:py-40">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header - Dramatic offset */}
        <div className="grid lg:grid-cols-12 gap-8 mb-20">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-8">
              <span className="w-12 h-px bg-foreground/30" />
              Pricing
            </span>
            <h2 className={`text-5xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}>
              Pay for
              <br />
              <span className="text-stroke">results.</span>
            </h2>
          </div>

          <div className="lg:col-span-5 relative p-0 h-96 lg:h-auto">
            {/* Whale image */}
            <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 delay-100 ${isVisible ? "opacity-100" : "opacity-0"
              }`}>
              <img
                src="/images/whale.png"
                alt="Organic whale"
                className="w-full h-full object-contain object-center"
              />
            </div>

          </div>
        </div>

        {/* Pricing cards - Horizontal layout with overlap */}
        <div className="relative">
          <div className="grid lg:grid-cols-3 gap-4 lg:gap-0">
            {plans.map((plan, index) => (
              <div
                key={plan.name}
                className={`relative bg-background border transition-all duration-700 ${plan.highlight
                  ? "border-foreground lg:-mx-2 lg:z-10 lg:scale-105"
                  : "border-foreground/10 lg:first:-mr-2 lg:last:-ml-2"
                  } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Popular badge */}
                {plan.highlight && (
                  <div className="absolute -top-4 left-8 right-8 flex justify-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs font-mono uppercase tracking-widest">
                      <Zap className="w-3 h-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8 lg:p-10">
                  {/* Plan header */}
                  <div className="mb-8 pb-8 border-b border-foreground/10">
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-2xl lg:text-3xl font-display mt-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    {plan.price.monthly !== null ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl lg:text-6xl font-display">
                          ${isAnnual ? plan.price.annual : plan.price.monthly}
                        </span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                    ) : (
                      <span className="text-4xl font-display">Custom</span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-10">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-[#eca8d6] mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleCta(plan)}
                    className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${plan.highlight
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                      }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note with icons */}
        <div className={`mt-20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 pt-12 border-t border-foreground/10 transition-all duration-1000 delay-500 ${isVisible ? "opacity-100" : "opacity-0"
          }`}>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#eca8d6]" />
              Encrypted execution
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#eca8d6]" />
              Full audit logs
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#eca8d6]" />
              Multi-model routing
            </span>
          </div>
          <a href="#" className="text-sm underline underline-offset-4 hover:text-foreground transition-colors">
            Compare all features
          </a>
        </div>
      </div>

      <style jsx>{`
        .text-stroke {
          -webkit-text-stroke: 1.5px currentColor;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* ─── Upgrade Modal ────────────────────────────────────────── */}
      {openModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-3xl animate-in fade-in duration-500"
            onClick={() => !isSubmitting && setOpenModal(null)}
          />

          <div className="relative w-full max-w-xl bg-card border border-foreground/10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-500">
            {/* Top Light Effect */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
            <div className="absolute top-[-10%] left-[20%] right-[20%] h-20 bg-primary/20 blur-[100px] rounded-full" />

            <div className="relative p-8 lg:p-12">
              <button
                onClick={() => setOpenModal(null)}
                className="absolute top-8 right-8 text-muted-foreground hover:text-foreground transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-6 h-6" />
              </button>

              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-mono mb-4 rounded-full">
                  <Zap className="w-3 h-3 fill-primary" />
                  Level Up Intelligence
                </div>
                <h2 className="text-3xl lg:text-4xl font-display text-foreground leading-[1.1]">
                  Upgrade to {openModal === "pro" ? "Pro Monitor" : "Enterprise"}
                </h2>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {openModal === "pro"
                    ? "Unlock the professional tier for advanced market surveillance. Provide your email so we can initiate your onboarding."
                    : "Tailored infrastructure for enterprise-scale operations. Share your requirements and our team will build a custom deployment plan."}
                </p>
              </div>

              {submitted ? (
                <div className="py-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6 border border-success/20">
                    <Check className="w-10 h-10 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Request Transmitted</h3>
                  <p className="text-muted-foreground">An acknowledgement mail has been sent. We will contact you soon to finalize your setup.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground ml-1">Work Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="you@company.com"
                        className="w-full h-14 bg-muted border border-foreground/5 rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  {openModal === "custom" && (
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground ml-1">Infrastructure Requirements</label>
                      <div className="relative">
                        <MessageSquare className="absolute left-4 top-5 w-4 h-4 text-muted-foreground" />
                        <textarea
                          required
                          value={formData.requirements}
                          onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                          placeholder="Tell us about your expected scan volume, integration needs, or compliance requirements..."
                          className="w-full h-40 bg-muted border border-foreground/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-primary/50 transition-all resize-none placeholder:text-muted-foreground/50"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="group relative w-full h-16 bg-foreground text-background font-bold rounded-2xl overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          Transmit Upgrade Request
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </button>

                  <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                    By submitting, you agree to our terms of processing. <br />
                    Response time: &lt; 4 hours during business days.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
