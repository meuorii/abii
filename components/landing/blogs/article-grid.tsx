import type { BlogArticle } from "./blog-data";
import { ArticleCard } from "./article-card";
import { StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";

export function ArticleGrid({ articles, onRead }: { articles: BlogArticle[]; onRead: (article: BlogArticle, trigger: HTMLElement) => void }) {
  return <StaggerContainer stagger={0.07} className="grid gap-x-7 gap-y-11 md:grid-cols-2 xl:grid-cols-3">{articles.map((article, index) => <StaggerItem key={article.slug} index={index}><ArticleCard article={article} onRead={onRead} /></StaggerItem>)}</StaggerContainer>;
}
