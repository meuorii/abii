import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BlogArticle } from "./blog-data";

export function ArticleCard({ article, onRead }: { article: BlogArticle; onRead: (article: BlogArticle, trigger: HTMLElement) => void }) {
  return (
    <article className="min-w-0">
      <Link
        className="group grid h-full grid-rows-[auto_1fr] text-inherit no-underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pink-active"
        href={`/blogs?article=${encodeURIComponent(article.slug)}`}
        aria-label={`Read ${article.title}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onRead(article, event.currentTarget);
        }}
      >
        <span className="aspect-[16/10] overflow-hidden rounded-lg bg-pink-soft"><Image className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]" src={article.image} alt={article.imageAlt} width={article.width} height={article.height} sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 64px) / 2), (max-width: 1199px) calc((100vw - 80px) / 3), 357px" /></span>
        <span className="flex flex-col items-start pt-4"><span className="text-xs font-semibold text-pink-active">{article.category}</span><span className="mt-2 text-xl font-semibold leading-[1.28] tracking-[-.025em]">{article.title}</span><span className="mt-2 text-[15px] leading-relaxed text-muted">{article.excerpt}</span><span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-pink-active">Read Article <ArrowUpRight aria-hidden="true" /></span>
        </span>
      </Link>
    </article>
  );
}
