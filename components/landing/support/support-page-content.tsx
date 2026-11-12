"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import { ResponsiveHero } from "../responsive-hero";
import { PageEntry } from "@/components/motion/page-entry";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";
import { ContactForm } from "./contact-form";
import { findGuide, helpCategories, popularGuideIds, supportFaqs, type HelpGuide } from "./support-content";

const container = "mx-auto w-[min(1152px,calc(100%-2.5rem))] sm:w-[min(1152px,calc(100%-3rem))]";
const sectionTitle = "text-[clamp(1.875rem,6vw,2.75rem)] font-bold leading-[1.08] tracking-[-.04em] md:text-[clamp(2.5rem,3.5vw,3.25rem)]";

type SearchResult =
  | { kind: "category"; id: string; title: string; detail: string }
  | { kind: "guide"; id: string; title: string; detail: string }
  | { kind: "faq"; id: string; title: string; detail: string };

function cleanQuery(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function scrollToSection(id: string) {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}

export function SupportPageContent() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(helpCategories[0].id);
  const [guideId, setGuideId] = useState(helpCategories[0].guides[0].id);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const activeCategory = helpCategories.find(category => category.id === categoryId) ?? helpCategories[0];
  const activeGuide = findGuide(guideId)?.guide ?? activeCategory.guides[0];

  const searchResults = useMemo(() => {
    const search = cleanQuery(query);
    if (!search) return [] as SearchResult[];
    const results: SearchResult[] = [];
    for (const category of helpCategories) {
      if (`${category.title} ${category.description}`.toLocaleLowerCase().includes(search)) {
        results.push({ kind: "category", id: category.id, title: category.title, detail: "Help topic" });
      }
      for (const guide of category.guides) {
        if (`${category.title} ${guide.title} ${guide.summary} ${guide.steps.join(" ")}`.toLocaleLowerCase().includes(search)) {
          results.push({ kind: "guide", id: guide.id, title: guide.title, detail: category.title });
        }
      }
    }
    for (const faq of supportFaqs) {
      if (`${faq.question} ${faq.answer}`.toLocaleLowerCase().includes(search)) {
        results.push({ kind: "faq", id: faq.id, title: faq.question, detail: "Frequently asked question" });
      }
    }
    return results.slice(0, 6);
  }, [query]);

  function selectGuide(guide: HelpGuide, category: (typeof helpCategories)[number], moveToGuide = true) {
    setCategoryId(category.id);
    setGuideId(guide.id);
    setQuery("");
    if (moveToGuide) requestAnimationFrame(() => scrollToSection("help-guide"));
  }

  function chooseSearchResult(result: SearchResult) {
    if (result.kind === "category") {
      setCategoryId(result.id);
      const category = helpCategories.find(item => item.id === result.id);
      if (category) setGuideId(category.guides[0].id);
      setQuery("");
      requestAnimationFrame(() => scrollToSection("help-center"));
      return;
    }
    if (result.kind === "guide") {
      const found = findGuide(result.id);
      if (found) selectGuide(found.guide, found.category);
      return;
    }
    const faq = supportFaqs.find(item => item.id === result.id);
    if (!faq) return;
    setOpenFaq(faq.id);
    setQuery("");
    requestAnimationFrame(() => {
      const trigger = document.getElementById(`faq-trigger-${faq.id}`);
      if (!trigger) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      trigger.scrollIntoView({ behavior, block: "center" });
      requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
    });
  }

  return <div className="bg-white text-foreground">
    <a className="absolute left-4 top-3 z-50 -translate-y-[180%] bg-white px-5 py-3 focus:translate-y-0 focus:outline-3 focus:outline-pink-active" href="#support-main">Skip to content</a>
    <LandingNav />
    <main id="support-main" tabIndex={-1}>
      <ResponsiveHero image="/landing/support/support-hero.png" titleId="support-title" mobileImageClassName="object-[72%_center]" desktopImageClassName="md:object-[58%_center] xl:object-center">
        <div className="w-full max-w-[35rem] md:max-w-[48%]">
          <PageEntry delay={0.08}><p className="mb-3 text-xs font-bold tracking-[.12em] text-pink-active">ABII SUPPORT</p></PageEntry>
          <PageEntry delay={0.14}><h1 id="support-title" className="max-w-[14ch] text-[clamp(2.125rem,8vw,3rem)] font-bold leading-[1.05] tracking-[-.04em] md:text-[clamp(3rem,4.5vw,4.25rem)]">A little help,<br /><span className="text-pink-active">whenever you need it.</span></h1></PageEntry>
          <PageEntry delay={0.28} distance={17} duration={0.75}><p className="mt-4 max-w-[48ch] text-[clamp(.9375rem,1.2vw,1.0625rem)] leading-[1.62] text-muted sm:mt-5">Find helpful guides, answers to common questions, and a friendly way to reach us whenever you need a hand.</p></PageEntry>
          <PageEntry delay={0.4} distance={12} duration={0.7}>
            <div className="mt-6 max-w-[40rem]" role="search" aria-label="Search Abii support">
              <label htmlFor="support-search" className="sr-only">Search for help, guides, or questions</label>
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-white/95 px-4 shadow-[0_8px_24px_rgb(47_41_48_/_7%)] focus-within:border-pink-active focus-within:ring-2 focus-within:ring-pink-active/20">
                <Search className="size-5 shrink-0 text-pink-active" aria-hidden="true" />
                <input id="support-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search for help, guides, or questions..." className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted" aria-controls="support-search-results" />
                {query && <button type="button" onClick={() => setQuery("")} className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-pink-soft hover:text-pink-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-active" aria-label="Clear support search"><X className="size-4" aria-hidden="true" /></button>}
              </div>
              {query && <div id="support-search-results" className="mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_12px_32px_rgb(47_41_48_/_10%)]" role="region" aria-label="Support search results" aria-live="polite">
                {searchResults.length ? <ul className="max-h-64 overflow-y-auto p-2">{searchResults.map(result => <li key={`${result.kind}-${result.id}`}><button type="button" onClick={() => chooseSearchResult(result)} className="flex min-h-12 w-full flex-col items-start justify-center rounded-xl px-3 py-2 text-left transition-colors hover:bg-pink-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pink-active"><span className="text-sm font-semibold text-foreground">{result.title}</span><span className="text-xs text-muted">{result.detail}</span></button></li>)}</ul> : <p className="px-4 py-4 text-sm text-muted">No matches yet. Try “flashcards,” “review,” or “password.”</p>}
              </div>}
            </div>
          </PageEntry>
        </div>
      </ResponsiveHero>

      <section id="help-center" className={`${container} scroll-mt-28 py-16 sm:scroll-mt-32 sm:py-24`} aria-labelledby="help-center-title">
        <div className="mb-9 max-w-[48rem]">
          <ScrollReveal><p className="text-xs font-bold tracking-[.12em] text-pink-active">HELP CENTER</p></ScrollReveal>
          <ScrollReveal delay={0.1}><h2 id="help-center-title" className={`mt-3 max-w-[20ch] ${sectionTitle}`}>Everything you need to find your rhythm.</h2></ScrollReveal>
          <ScrollReveal delay={0.18}><p className="mt-4 max-w-[66ch] text-base leading-[1.7] text-muted">From organizing your subjects to reviewing what you&apos;ve learned, explore simple guides to help you make the most of Abii.</p></ScrollReveal>
        </div>

        <StaggerContainer stagger={0.07} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {helpCategories.map((category, index) => {
            const Icon = category.icon;
            const selected = category.id === categoryId;
            return <StaggerItem key={category.id} index={index} className="h-full"><button type="button" aria-pressed={selected} onClick={() => { setCategoryId(category.id); setGuideId(category.guides[0].id); }} className={`flex h-full min-h-[116px] w-full items-start gap-4 rounded-2xl border p-5 text-left transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-pink/80 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active motion-reduce:transform-none ${selected ? "border-pink-primary bg-pink-soft" : "border-border bg-white"}`}>
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${selected ? "bg-pink-card text-pink-active" : "bg-pink-soft text-pink-primary"}`}><Icon className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0"><span className="block text-base font-semibold text-foreground">{category.title}</span><span className="mt-1 block text-sm leading-relaxed text-muted">{category.description}</span></span>
            </button></StaggerItem>;
          })}
        </StaggerContainer>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(15rem,.72fr)_minmax(0,1.28fr)] lg:gap-12">
          <ScrollReveal>
            <h3 className="text-sm font-semibold text-foreground">{activeCategory.title} guides</h3>
            <ul className="mt-3 grid gap-1">
              {activeCategory.guides.map(guide => <li key={guide.id}><button type="button" aria-current={guide.id === activeGuide.id ? "true" : undefined} onClick={() => selectGuide(guide, activeCategory, false)} className={`min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-pink-soft focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-pink-active ${guide.id === activeGuide.id ? "bg-pink-soft font-semibold text-pink-active" : "text-muted"}`}>{guide.title}</button></li>)}
            </ul>
          </ScrollReveal>
          <ScrollReveal preset="card" id="help-guide" className="scroll-mt-32 rounded-[1.5rem] bg-pink-soft p-6 sm:p-8" aria-live="polite" aria-atomic="true">
            <p className="text-xs font-bold tracking-[.1em] text-pink-active">{activeCategory.title}</p>
            <h3 id="help-guide-title" tabIndex={-1} className="mt-2 text-xl font-bold tracking-[-.025em] sm:text-2xl">{activeGuide.title}</h3>
            <p className="mt-2 max-w-[62ch] text-sm leading-[1.7] text-muted">{activeGuide.summary}</p>
            <ol className="mt-5 grid gap-3">
              {activeGuide.steps.map((step, index) => <li key={`${activeGuide.id}-${index}`} className="flex gap-3 text-sm leading-[1.65] text-foreground"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-pink-card text-xs font-bold text-pink-active">{index + 1}</span><span>{step}</span></li>)}
            </ol>
            {activeGuide.note && <p className="mt-5 border-l-2 border-pink-primary pl-3 text-sm leading-relaxed text-muted">{activeGuide.note}</p>}
            {activeGuide.href && <a href={activeGuide.href} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-pink-active underline decoration-pink/80 underline-offset-4 transition-colors hover:text-pink-primary focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pink-active">Open in Abii</a>}
          </ScrollReveal>
        </div>

        <ScrollReveal className="mt-10 border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-foreground">Popular guides</h3>
          <div className="mt-3 flex flex-wrap gap-2">{popularGuideIds.map(id => {
            const found = findGuide(id);
            if (!found) return null;
            return <button key={id} type="button" onClick={() => selectGuide(found.guide, found.category)} className="inline-flex min-h-10 items-center rounded-full border border-border bg-white px-4 py-2 text-sm text-muted transition-colors hover:border-pink-primary hover:bg-pink-soft hover:text-pink-active focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active">{found.guide.title}</button>;
          })}</div>
        </ScrollReveal>
      </section>

      <section id="faqs" className="scroll-mt-28 bg-pink-soft px-5 py-16 sm:scroll-mt-32 sm:px-6 sm:py-24" aria-labelledby="faqs-title">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
          <div>
            <ScrollReveal><p className="text-xs font-bold tracking-[.12em] text-pink-active">FREQUENTLY ASKED QUESTIONS</p></ScrollReveal>
            <ScrollReveal delay={0.1}><h2 id="faqs-title" className={`mt-3 max-w-[15ch] ${sectionTitle}`}>Good questions deserve simple answers.</h2></ScrollReveal>
            <ScrollReveal delay={0.18}><p className="mt-4 max-w-[42ch] text-base leading-[1.7] text-muted">Here are a few things students often want to know about learning with Abii.</p></ScrollReveal>
          </div>
          <StaggerContainer className="divide-y divide-border border-y border-border">
            {supportFaqs.map((faq, index) => {
              const expanded = openFaq === faq.id;
              const related = faq.guideId ? findGuide(faq.guideId) : null;
              return <StaggerItem key={faq.id} index={index} className="min-w-0">
                <div className="py-1">
                  <button id={`faq-trigger-${faq.id}`} type="button" aria-expanded={expanded} aria-controls={`faq-answer-${faq.id}`} onClick={() => setOpenFaq(current => current === faq.id ? null : faq.id)} className="flex min-h-14 w-full items-center justify-between gap-5 py-4 text-left text-base font-semibold leading-snug text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pink-active sm:text-[17px]">
                    <span>{faq.question}</span><span className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${expanded ? "bg-pink-card text-pink-active" : "text-muted"}`}>{expanded ? <Minus className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}</span>
                  </button>
                  <div id={`faq-answer-${faq.id}`} aria-hidden={!expanded} inert={!expanded} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden"><div className="max-w-[62ch] pb-5 pr-8 text-[15px] leading-[1.75] text-muted">{faq.answer}{related && <p className="mt-3"><button type="button" onClick={() => selectGuide(related.guide, related.category)} className="font-semibold text-pink-active underline decoration-pink/80 underline-offset-4 hover:text-pink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-active">Read: {related.guide.title}</button></p>}</div></div>
                  </div>
                </div>
              </StaggerItem>;
            })}
          </StaggerContainer>
        </div>
      </section>

      <section id="contact" className={`${container} scroll-mt-28 py-16 sm:scroll-mt-32 sm:py-24`} aria-labelledby="contact-title">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)] lg:gap-16">
          <div>
            <ScrollReveal><p className="text-xs font-bold tracking-[.12em] text-pink-active">CONTACT US</p></ScrollReveal>
            <ScrollReveal delay={0.1}><h2 id="contact-title" className={`mt-3 max-w-[17ch] ${sectionTitle}`}>Still need a hand? We&apos;re here to listen.</h2></ScrollReveal>
            <ScrollReveal delay={0.18}><p className="mb-7 mt-4 max-w-[52ch] text-base leading-[1.7] text-muted">Didn&apos;t find what you were looking for? Send us a message and tell us how we can help.</p></ScrollReveal>
            <ScrollReveal preset="card" delay={0.24}><ContactForm /></ScrollReveal>
          </div>
          <ScrollReveal preset="image" delay={0.18} className="mx-auto w-full max-w-[27rem] lg:order-last">
            <div className="rounded-[2rem] bg-pink-soft px-6 pt-5 sm:px-9 sm:pt-8">
              <Image src="/landing/support/support-contact-mascot.png" alt="Abii waving hello" width={1174} height={1204} quality={95} sizes="(max-width: 1023px) min(84vw, 432px), 432px" className="mx-auto h-auto w-full object-contain" />
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
    <LandingFooter />
  </div>;
}
