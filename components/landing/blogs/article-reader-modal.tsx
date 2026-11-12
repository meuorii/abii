"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { BlogArticle } from "./blog-data";
import type { ArticleBlock } from "./article-bodies";
import styles from "./article-reader-modal.module.css";

export function ArticleReaderModal({ article, blocks, loading, onClose }: { article: BlogArticle | null; blocks: ArticleBlock[]; loading: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const suppressCloseRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = `reader-title-${article?.slug ?? "closed"}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (article && scrollRef.current) scrollRef.current.scrollTop = 0;
    if (article && !dialog.open) dialog.showModal();
    else if (!article && dialog.open) {
      suppressCloseRef.current = true;
      dialog.close();
    }
  }, [article]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.readerDialog}
      aria-labelledby={article ? titleId : undefined}
      onCancel={(event) => { event.preventDefault(); dialogRef.current?.close(); }}
      onClose={() => {
        if (suppressCloseRef.current) { suppressCloseRef.current = false; return; }
        onClose();
      }}
      onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
    >
      {article && <>
        <div className={styles.readerToolbar}>
          <span className={styles.readerBrand}>ABII JOURNAL</span>
          <span className={styles.readerMastheadNote} aria-hidden="true">Ideas for better learning</span>
          <button type="button" className={styles.readerClose} aria-label={`Close ${article.title}`} onClick={() => dialogRef.current?.close()}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className={styles.readerScroll} ref={scrollRef}>
          <article className={styles.readerArticle} aria-busy={loading} aria-labelledby={titleId}>
            <header className={styles.readerHeader}>
              <p className={styles.readerCategory}>{article.category}</p>
              <h2 id={titleId}>{article.title}</h2>
              <p className={styles.readerExcerpt}>{article.excerpt}</p>
            </header>
            <div className={styles.readerImage}>
              <Image src={article.image} alt={article.imageAlt} width={article.width} height={article.height} sizes="(max-width: 700px) calc(100vw - 32px), (max-width: 999px) 82vw, 820px" priority />
            </div>
            <div className={styles.readerBody}>
              {loading ? <p role="status" className={styles.loadingMessage}>Opening the article…</p> : blocks.map((block, index) => block.type === "heading"
                ? <h3 key={`${article.slug}-heading-${index}`}>{block.text}</h3>
                : <p key={`${article.slug}-paragraph-${index}`}>{block.text}</p>)}
            </div>
            {!loading && <footer className={styles.readerEnd}><span aria-hidden="true" /><p>End of article</p><span aria-hidden="true" /></footer>}
          </article>
        </div>
      </>}
    </dialog>
  );
}
