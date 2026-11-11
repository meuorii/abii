import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BlogArticle } from "./blog-data";
import styles from "./blogs-page.module.css";

export function ArticleCard({ article, onRead }: { article: BlogArticle; onRead: (article: BlogArticle, trigger: HTMLElement) => void }) {
  return (
    <article className={styles.articleCard}>
      <Link
        className={styles.articleLink}
        href={`/blogs?article=${encodeURIComponent(article.slug)}`}
        aria-label={`Read ${article.title}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onRead(article, event.currentTarget);
        }}
      >
        <span className={styles.cardImage}>
          <Image src={article.image} alt={article.imageAlt} width={article.width} height={article.height} sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 64px) / 2), (max-width: 1199px) calc((100vw - 80px) / 3), 357px" />
        </span>
        <span className={styles.cardCopy}>
          <span className={styles.category}>{article.category}</span>
          <span className={styles.articleTitle}>{article.title}</span>
          <span className={styles.excerpt}>{article.excerpt}</span>
          <span className={styles.readLink}>Read Article <ArrowUpRight aria-hidden="true" /></span>
        </span>
      </Link>
    </article>
  );
}
