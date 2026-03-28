import React from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const FALLBACK_IMG =
  "https://cdn.ruwiki.ru/commonswiki/files/e/ee/WW2_collage.jpg";

/**
 * @typedef {{ id: string, kind: string, headline: string, body: string, imageUrl?: string, sourceUrl?: string, sourceLabel?: string }} HomeFeedItem
 */

export default function HomeFactsMarquee({ items, loading, error, onRetry }) {
  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Не удалось загрузить факты</CardTitle>
          <CardDescription>
            {typeof error === "string" ? error : "Проверьте соединение и попробуйте снова."}
          </CardDescription>
          {typeof onRetry === "function" ? (
            <button
              type="button"
              className="text-primary mt-2 text-sm font-medium underline underline-offset-2"
              onClick={onRetry}
            >
              Повторить
            </button>
          ) : null}
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="home-facts-marquee home-facts-marquee--static">
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((k) => (
            <Card key={k} className="home-facts-card home-story-card shrink-0">
              <Skeleton className="home-facts-card-image rounded-none rounded-t-xl" />
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пока нечего показать</CardTitle>
          <CardDescription>
            Добавьте родственников и даты в карточках — здесь появятся факты о роде и пересечения с эпохами.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const loop = [...items, ...items];

  return (
    <div className="home-facts-marquee">
      <div className="home-facts-track">
        {loop.map((it, i) => (
          <Card key={`${it.id}-${i}`} className="home-facts-card home-story-card">
            <img
              src={it.imageUrl || FALLBACK_IMG}
              alt=""
              className="home-historical-image home-facts-card-image"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                if (e.currentTarget.src === FALLBACK_IMG) return;
                e.currentTarget.src = FALLBACK_IMG;
              }}
            />
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={it.kind === "era" ? "default" : it.kind === "ai" ? "outline" : "secondary"}
                >
                  {it.kind === "era" ? "Эпоха и род" : it.kind === "ai" ? "ИИ" : "Ваш род"}
                </Badge>
              </div>
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                {it.headline}
              </CardDescription>
              <CardTitle className="text-base leading-snug font-normal text-foreground">{it.body}</CardTitle>
              {it.sourceUrl ? (
                <CardDescription className="pt-1">
                  <a href={it.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                    {it.sourceLabel || "РУВИКИ"}
                  </a>
                </CardDescription>
              ) : it.kind === "ai" && it.sourceLabel ? (
                <CardDescription className="text-muted-foreground pt-1 text-xs">{it.sourceLabel}</CardDescription>
              ) : null}
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
