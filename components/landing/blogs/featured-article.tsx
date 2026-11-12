import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { BlogArticle } from "./blog-data";
import { ScrollReveal } from "@/components/motion/scroll-reveal";

export function FeaturedArticle({ article, onRead }: { article: BlogArticle; onRead: (article: BlogArticle, trigger: HTMLElement) => void }) {
  return (
    <section className="px-5 py-16 sm:px-6 sm:pb-24" aria-labelledby="featured-title">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.16fr_.84fr] lg:gap-[clamp(2.75rem,7vw,5.75rem)]">
        <ScrollReveal preset="image"><button type="button" className="w-full overflow-hidden rounded-xl bg-pink-soft text-left focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pink-active" onClick={(event) => onRead(article, event.currentTarget)} aria-label={`Read ${article.title}`}>
          <Image className="aspect-[5/4] w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.02]" src={article.image} alt={article.imageAlt} width={2333} height={1866} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1199px) 55vw, 620px" />
        </button></ScrollReveal>
        <div className="max-w-[27.5rem] py-2"><ScrollReveal><p className="text-sm font-semibold text-pink-active">Featured Article</p></ScrollReveal><ScrollReveal delay={0.08}><h2 id="featured-title" className="mt-3 text-[clamp(1.875rem,6vw,2.5rem)] font-bold leading-[1.1] tracking-[-.035em] md:text-[clamp(2.25rem,3.1vw,2.75rem)]">{article.title}</h2></ScrollReveal><ScrollReveal delay={0.16}><p className="mt-4 max-w-[40ch] text-base leading-[1.7] text-muted">{article.excerpt}</p></ScrollReveal><ScrollReveal preset="button" delay={0.22}><p className="mt-5 flex flex-wrap gap-2 text-sm text-muted">Category <span className="font-semibold text-foreground">{article.category}</span></p><button type="button" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pink-active transition-colors hover:text-pink-primary focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pink-active" onClick={(event) => onRead(article, event.currentTarget)} aria-label={`Read ${article.title}`}>
            Read Article <ArrowUpRight aria-hidden="true" />
          </button></ScrollReveal></div>
      </div>
    </section>
  );
}
