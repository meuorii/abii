"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ResponsiveHero } from "../responsive-hero";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import { ArticleGrid } from "./article-grid";
import { FeaturedArticle } from "./featured-article";
import { ArticleReaderModal } from "./article-reader-modal";
import { articles, categories, featuredArticle, type BlogArticle, type BlogCategory } from "./blog-data";
import type { ArticleBlock } from "./article-bodies";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { PageEntry } from "@/components/motion/page-entry";

export function BlogsPageContent() {
  const [category, setCategory] = useState<"All Articles" | BlogCategory>("All Articles");
  const [activeArticle, setActiveArticle] = useState<BlogArticle | null>(null);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const activeSlugRef = useRef<string | null>(null);

  const showArticle = useCallback(async (article: BlogArticle, trigger?: HTMLElement) => {
    if (trigger) triggerRef.current = trigger;
    activeSlugRef.current = article.slug;
    setActiveArticle(article);
    setBlocks([]);
    setLoading(true);
    const url = new URL(window.location.href);
    if (url.searchParams.get("article") !== article.slug) {
      url.searchParams.set("article", article.slug);
      window.history.pushState({ blogArticle: article.slug }, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const content = await import("./article-bodies");
    if (activeSlugRef.current === article.slug) {
      setBlocks(content.articleBodies[article.slug] ?? []);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const slug = new URL(window.location.href).searchParams.get("article");
      const article = slug === featuredArticle.slug ? featuredArticle : articles.find((item) => item.slug === slug);
      if (article) void showArticle(article);
      else {
        if (slug) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("article");
          window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
        }
        activeSlugRef.current = null;
        setActiveArticle(null);
        requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
      }
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [showArticle]);

  const closeArticle = () => {
    const slug = activeArticle?.slug;
    activeSlugRef.current = null;
    setActiveArticle(null);
    setBlocks([]);
    setLoading(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    const url = new URL(window.location.href);
    if (url.searchParams.has("article")) {
      if (window.history.state?.blogArticle === slug) window.history.back();
      else {
        url.searchParams.delete("article");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
  };

  const visibleArticles = category === "All Articles" ? articles : articles.filter((article) => article.category === category);

  return (
    <div className="bg-white text-foreground">
      <a className="absolute left-4 top-3 z-50 -translate-y-[180%] bg-white px-5 py-3 focus:translate-y-0 focus:outline-3 focus:outline-pink-active" href="#blogs-main">Skip to content</a>
      <LandingNav />
      <main id="blogs-main" tabIndex={-1}>
        <ResponsiveHero image="/landing/blogs/hero-blogs.png" titleId="blogs-title" mobileImageClassName="object-[68%_center]" desktopImageClassName="md:object-[56%_center] xl:object-center"><div className="max-w-[35rem] md:max-w-[48%]">
              <PageEntry delay={0.12}><h1 id="blogs-title" className="max-w-[13ch] text-[clamp(2.125rem,8vw,3rem)] font-bold leading-[1.05] tracking-[-.04em] md:text-[clamp(3rem,4.5vw,4.25rem)]">Little ideas for<br /><span className="text-pink-active">better learning.</span></h1></PageEntry>
              <PageEntry delay={0.3} distance={17} duration={0.75}><p className="mt-4 max-w-[46ch] text-[clamp(.9375rem,1.2vw,1.0625rem)] leading-[1.62] text-muted sm:mt-5">Explore study tips, learning techniques, and thoughtful ideas to make every study session a little more meaningful.</p></PageEntry>
          </div></ResponsiveHero>

        <FeaturedArticle article={featuredArticle} onRead={(article, trigger) => void showArticle(article, trigger)} />

        <section className="mx-auto w-[min(1120px,calc(100%-2.5rem))] pb-20 sm:w-[min(1120px,calc(100%-3rem))] sm:pb-28" aria-labelledby="explore-title">
          <div className="grid items-end gap-4 md:grid-cols-[1fr_minmax(15rem,22.5rem)] md:gap-10">
            <div>
              <ScrollReveal><h2 id="explore-title" className="max-w-[20ch] text-[clamp(1.875rem,6vw,2.5rem)] font-bold leading-[1.1] tracking-[-.04em] md:text-[clamp(2.5rem,3.5vw,3.25rem)]">A little something for <span className="text-pink-active">every curious mind.</span></h2></ScrollReveal>
            </div>
            <ScrollReveal delay={0.12}><p className="text-base leading-relaxed text-muted">From study techniques to everyday moments, find ideas, inspiration, and stories worth exploring.</p></ScrollReveal>
          </div>

          <ScrollReveal preset="button" delay={0.2} className="mt-8"><div className="flex gap-6 overflow-x-auto border-b border-border pb-0" role="group" aria-label="Filter articles by category">
            {categories.map((item) => <button type="button" className="relative min-h-11 shrink-0 pb-3 text-sm font-medium text-muted transition-colors hover:text-pink-active aria-pressed:text-pink-active aria-pressed:after:absolute aria-pressed:after:inset-x-0 aria-pressed:after:bottom-0 aria-pressed:after:h-0.5 aria-pressed:after:bg-pink-active focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div></ScrollReveal>
          <ArticleGrid articles={visibleArticles} onRead={(article, trigger) => void showArticle(article, trigger)} />
        </section>
      </main>
      <LandingFooter />
      <ArticleReaderModal article={activeArticle} blocks={blocks} loading={loading} onClose={closeArticle} />
    </div>
  );
}
