"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import { ArticleGrid } from "./article-grid";
import { FeaturedArticle } from "./featured-article";
import { ArticleReaderModal } from "./article-reader-modal";
import { articles, categories, featuredArticle, type BlogArticle, type BlogCategory } from "./blog-data";
import type { ArticleBlock } from "./article-bodies";
import styles from "./blogs-page.module.css";

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
    <div className={`${styles.page} landing-page`}>
      <a className={styles.skipLink} href="#blogs-main">Skip to content</a>
      <LandingNav />
      <main id="blogs-main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="blogs-title">
          <div className={styles.heroArt}>
            {/* Artwork follows the established public-page 1672 / 941 hero frame. */}
            <Image src="/landing/blogs/hero-blogs.png" alt="" width={1672} height={941} priority quality={95} sizes="(max-width: 767px) 100vw, 100vw" />
          </div>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <h1 id="blogs-title">Little ideas for<br /><span>better learning.</span></h1>
              <p>Explore study tips, learning techniques, and thoughtful ideas to make every study session a little more meaningful.</p>
            </div>
          </div>
        </section>

        <FeaturedArticle article={featuredArticle} onRead={(article, trigger) => void showArticle(article, trigger)} />

        <section className={styles.exploreSection} aria-labelledby="explore-title">
          <div className={styles.exploreHeader}>
            <div>
              <p className={styles.sectionLabel}>Explore Articles</p>
              <h2 id="explore-title">A little something for<br className={styles.mobileBreak} /> <span>every curious mind.</span></h2>
            </div>
            <p className={styles.exploreDescription}>From study techniques to everyday moments, find ideas, inspiration, and stories worth exploring.</p>
          </div>

          <div className={styles.filters} role="group" aria-label="Filter articles by category">
            {categories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <ArticleGrid articles={visibleArticles} onRead={(article, trigger) => void showArticle(article, trigger)} />
        </section>
      </main>
      <LandingFooter />
      <ArticleReaderModal article={activeArticle} blocks={blocks} loading={loading} onClose={closeArticle} />
    </div>
  );
}
