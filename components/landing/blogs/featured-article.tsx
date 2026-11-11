import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { BlogArticle } from "./blog-data";
import styles from "./blogs-page.module.css";

export function FeaturedArticle({ article, onRead }: { article: BlogArticle; onRead: (article: BlogArticle, trigger: HTMLElement) => void }) {
  return (
    <section className={styles.featuredSection} aria-labelledby="featured-title">
      <div className={styles.featuredLayout}>
        <button type="button" className={styles.featuredImageButton} onClick={(event) => onRead(article, event.currentTarget)} aria-label={`Read ${article.title}`}>
          <Image src={article.image} alt={article.imageAlt} width={2333} height={1866} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1199px) 55vw, 620px" />
        </button>
        <div className={styles.featuredCopy}>
          <p className={styles.category}>Featured Article</p>
          <h2 id="featured-title">{article.title}</h2>
          <p className={styles.featuredExcerpt}>{article.excerpt}</p>
          <p className={styles.featuredCategory}>Category <span>{article.category}</span></p>
          <button type="button" className={styles.readAction} onClick={(event) => onRead(article, event.currentTarget)} aria-label={`Read ${article.title}`}>
            Read Article <ArrowUpRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
