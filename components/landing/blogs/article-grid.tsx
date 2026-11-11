import type { BlogArticle } from "./blog-data";
import { ArticleCard } from "./article-card";
import styles from "./blogs-page.module.css";

export function ArticleGrid({ articles, onRead }: { articles: BlogArticle[]; onRead: (article: BlogArticle, trigger: HTMLElement) => void }) {
  return <div className={styles.articleGrid}>{articles.map((article) => <ArticleCard key={article.slug} article={article} onRead={onRead} />)}</div>;
}
