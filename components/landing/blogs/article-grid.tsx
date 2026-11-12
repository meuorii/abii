import type { BlogArticle } from "./blog-data";
import { ArticleCard } from "./article-card";

export function ArticleGrid({ articles, onRead }: { articles: BlogArticle[]; onRead: (article: BlogArticle, trigger: HTMLElement) => void }) {
  return <div className="grid gap-x-7 gap-y-11 md:grid-cols-2 xl:grid-cols-3">{articles.map((article) => <ArticleCard key={article.slug} article={article} onRead={onRead} />)}</div>;
}
