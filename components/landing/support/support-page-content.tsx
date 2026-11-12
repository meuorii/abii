"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import { ResponsiveHero } from "../responsive-hero";
import { PageEntry } from "@/components/motion/page-entry";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";
import { ContactForm } from "./contact-form";
import { findGuide, helpCategories, supportFaqs, type HelpGuide } from "./support-content";

const container = "mx-auto w-[min(1152px,calc(100%-2.5rem))] sm:w-[min(1152px,calc(100%-3rem))]";
const sectionTitle = "text-[clamp(1.875rem,6vw,2.75rem)] font-bold leading-[1.08] tracking-[-.035em] md:text-[clamp(2.5rem,3.5vw,3.25rem)]";
const guideLink = "min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm leading-snug text-muted transition-colors duration-150 hover:bg-pink-soft hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-pink-active";

function scrollToSection(id: string) {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}

export function SupportPageContent() {
  const [categoryId, setCategoryId] = useState(helpCategories[0].id);
  const [guideId, setGuideId] = useState(helpCategories[0].guides[0].id);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const activeCategory = helpCategories.find(category => category.id === categoryId) ?? helpCategories[0];
  const activeGuide = findGuide(guideId)?.guide ?? activeCategory.guides[0];

  function selectCategory(id: string) {
    const category = helpCategories.find(item => item.id === id);
    if (!category) return;
    setCategoryId(category.id);
    setGuideId(category.guides[0].id);
  }

  function selectGuide(guide: HelpGuide, category: (typeof helpCategories)[number], moveToGuide = true) {
    setCategoryId(category.id);
    setGuideId(guide.id);
    if (moveToGuide) requestAnimationFrame(() => scrollToSection("help-guide"));
  }

  return <div className="bg-white text-foreground">
    <a className="absolute left-4 top-3 z-50 -translate-y-[180%] bg-white px-5 py-3 focus:translate-y-0 focus:outline-3 focus:outline-pink-active" href="#support-main">Skip to content</a>
    <LandingNav />
    <main id="support-main" tabIndex={-1}>
      <ResponsiveHero image="/landing/support/support-hero.png" titleId="support-title" mobileImageClassName="object-[72%_center]" desktopImageClassName="md:object-[58%_center] xl:object-center">
        <div className="w-full max-w-[35rem] md:max-w-[48%]">
          <PageEntry delay={0.12}>
            <h1 id="support-title" className="max-w-[14ch] text-[clamp(2.125rem,8vw,3rem)] font-bold leading-[1.05] tracking-[-.04em] md:text-[clamp(3rem,4.5vw,4.25rem)]">A little help,<br /><span className="text-pink-active">whenever you need it.</span></h1>
          </PageEntry>
          <PageEntry delay={0.28} distance={17} duration={0.75}>
            <p className="mt-4 max-w-[48ch] text-[clamp(.9375rem,1.2vw,1.0625rem)] leading-[1.62] text-muted sm:mt-5">Find helpful guides, answers to common questions, and a friendly way to reach us whenever you need a hand.</p>
          </PageEntry>
        </div>
      </ResponsiveHero>

      <section id="help-center" className={`${container} scroll-mt-28 py-16 sm:scroll-mt-32 sm:py-24`} aria-labelledby="help-center-title">
        <header className="mb-10 max-w-[49rem] sm:mb-12">
          <ScrollReveal><h2 id="help-center-title" className={`max-w-[19ch] ${sectionTitle}`}>Everything you need to find your rhythm.</h2></ScrollReveal>
          <ScrollReveal delay={0.12}><p className="mt-4 max-w-[66ch] text-base leading-[1.7] text-muted">From organizing your subjects to reviewing what you&apos;ve learned, explore simple guides to help you make the most of Abii.</p></ScrollReveal>
        </header>

        <div className="grid items-start gap-8 border-t border-border/80 pt-7 lg:grid-cols-[minmax(14rem,.68fr)_minmax(0,1.32fr)] lg:gap-14 lg:pt-9">
          <aside aria-label="Help topics and guides" className="min-w-0">
            <label className="sr-only" htmlFor="support-category-select">Choose a help topic</label>
            <select id="support-category-select" value={categoryId} onChange={event => selectCategory(event.target.value)} className="min-h-12 w-full rounded-xl border border-border bg-white px-4 py-3 text-base font-semibold text-foreground outline-none focus:border-pink-active focus:ring-2 focus:ring-pink-active/20 lg:hidden">
              {helpCategories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}
            </select>

            <nav className="hidden lg:block" aria-label="Help topics">
              <ul className="grid border-b border-border/80 pb-5">
                {helpCategories.map(category => {
                  const Icon = category.icon;
                  const selected = category.id === activeCategory.id;
                  return <li key={category.id}>
                    <button type="button" aria-pressed={selected} onClick={() => selectCategory(category.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pink-active ${selected ? "bg-pink-soft text-pink-active" : "text-muted hover:bg-pink-soft/70 hover:text-foreground"}`}>
                      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                      <span>{category.title}</span>
                    </button>
                  </li>;
                })}
              </ul>
              <GuideNavigation category={activeCategory} activeGuideId={activeGuide.id} onSelect={guide => selectGuide(guide, activeCategory, false)} />
            </nav>

            <div className="mt-5 lg:hidden"><GuideNavigation category={activeCategory} activeGuideId={activeGuide.id} onSelect={guide => selectGuide(guide, activeCategory, false)} compact /></div>
          </aside>

          <ScrollReveal preset="card" id="help-guide" className="scroll-mt-32 min-w-0 border-t border-border/80 pt-7 lg:border-t-0 lg:pt-1" aria-live="polite" aria-atomic="true">
            <p className="text-sm font-semibold text-pink-active">{activeCategory.title}</p>
            <h3 id="help-guide-title" tabIndex={-1} className="mt-2 max-w-[24ch] text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.15] tracking-[-.03em]">{activeGuide.title}</h3>
            <p className="mt-4 max-w-[62ch] text-base leading-[1.75] text-muted">{activeGuide.summary}</p>
            <ol className="mt-7 grid max-w-[64ch] list-decimal gap-4 border-t border-border/80 pl-6 pt-5 marker:font-semibold marker:text-pink-active sm:gap-5">
              {activeGuide.steps.map((step, index) => <li key={`${activeGuide.id}-${index}`} className="pl-2 text-[15px] leading-[1.75] text-foreground">{step}</li>)}
            </ol>
            {activeGuide.note && <p className="mt-6 max-w-[62ch] text-sm leading-[1.7] text-muted">{activeGuide.note}</p>}
            {activeGuide.href && <Link href={activeGuide.href} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-pink-active underline decoration-pink/70 underline-offset-4 transition-colors hover:text-pink-primary focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pink-active">Open in Abii</Link>}
          </ScrollReveal>

        </div>
      </section>

      <section id="faqs" className="scroll-mt-28 border-y border-border/70 bg-white px-5 py-16 sm:scroll-mt-32 sm:px-6 sm:py-24" aria-labelledby="faqs-title">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(15rem,.72fr)_minmax(0,1.28fr)] lg:gap-16">
          <div className="max-w-[29rem]">
            <ScrollReveal><h2 id="faqs-title" className={`max-w-[14ch] ${sectionTitle}`}>Good questions deserve simple answers.</h2></ScrollReveal>
            <ScrollReveal delay={0.12}><p className="mt-4 max-w-[40ch] text-base leading-[1.7] text-muted">Here are a few things students often want to know about learning with Abii.</p></ScrollReveal>
          </div>
          <StaggerContainer className="divide-y divide-border/90 border-y border-border/90">
            {supportFaqs.map((faq, index) => {
              const expanded = openFaq === faq.id;
              const related = faq.guideId ? findGuide(faq.guideId) : null;
              return <StaggerItem key={faq.id} index={index} className="min-w-0">
                <div className="py-1">
                  <button id={`faq-trigger-${faq.id}`} type="button" aria-expanded={expanded} aria-controls={`faq-answer-${faq.id}`} onClick={() => setOpenFaq(current => current === faq.id ? null : faq.id)} className="flex min-h-14 w-full items-center justify-between gap-5 py-4 text-left text-[16px] font-semibold leading-snug text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pink-active sm:text-[17px]">
                    <span>{faq.question}</span><span className="shrink-0 text-pink-active" aria-hidden="true">{expanded ? <Minus className="size-[18px]" /> : <Plus className="size-[18px]" />}</span>
                  </button>
                  <div id={`faq-answer-${faq.id}`} aria-hidden={!expanded} inert={!expanded} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden"><div className="max-w-[62ch] pb-5 pr-8 text-[15px] leading-[1.75] text-muted">{faq.answer}{related && <p className="mt-3"><button type="button" onClick={() => selectGuide(related.guide, related.category)} className="font-semibold text-pink-active underline decoration-pink/70 underline-offset-4 transition-colors hover:text-pink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-active">Read: {related.guide.title}</button></p>}</div></div>
                  </div>
                </div>
              </StaggerItem>;
            })}
          </StaggerContainer>
        </div>
      </section>

      <section id="contact" className="scroll-mt-28 bg-pink-soft px-5 py-16 sm:scroll-mt-32 sm:px-6 sm:py-24" aria-labelledby="contact-title">
        <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] lg:gap-16">
          <div className="min-w-0">
            <ScrollReveal><h2 id="contact-title" className={`max-w-[18ch] ${sectionTitle}`}>Still need a hand? We&apos;re here to listen.</h2></ScrollReveal>
            <ScrollReveal delay={0.12}><p className="mb-7 mt-4 max-w-[52ch] text-base leading-[1.7] text-muted lg:mb-0">Didn&apos;t find what you were looking for? Send us a message and tell us how we can help.</p></ScrollReveal>
          </div>
          <ScrollReveal preset="card" delay={0.2} className="w-full max-w-[44rem] lg:justify-self-end"><ContactForm /></ScrollReveal>
        </div>
      </section>
    </main>
    <LandingFooter />
  </div>;
}

function GuideNavigation({
  category,
  activeGuideId,
  onSelect,
  compact = false,
}: {
  category: (typeof helpCategories)[number];
  activeGuideId: string;
  onSelect: (guide: HelpGuide) => void;
  compact?: boolean;
}) {
  return <div className={compact ? "" : "mt-6"}>
    <h3 className="mb-2 px-3 text-xs font-semibold text-muted">{category.title} guides</h3>
    <ul className={compact ? "grid gap-1 sm:grid-cols-2" : "grid gap-1"}>
      {category.guides.map(guide => <li key={guide.id}>
        <button type="button" aria-pressed={guide.id === activeGuideId} onClick={() => onSelect(guide)} className={`${guideLink} ${guide.id === activeGuideId ? "bg-pink-soft font-semibold text-pink-active" : ""}`}>{guide.title}</button>
      </li>)}
    </ul>
  </div>;
}
