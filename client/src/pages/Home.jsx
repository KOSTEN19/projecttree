import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { apiGet } from "../api.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import HomeFactsMarquee from "../components/HomeFactsMarquee.jsx";

function fullName(p) {
  return [p?.lastName, p?.firstName, p?.middleName].filter(Boolean).join(" ").trim() || "Без имени";
}

function toYear(v) {
  const y = parseInt(String(v || "").slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function initials(p) {
  const f = String(p?.firstName || "?")[0] || "?";
  const l = String(p?.lastName || "")[0] || "";
  return `${f}${l}`.toUpperCase();
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export default function Home({ user }) {
  const location = useLocation();
  const [globalStats, setGlobalStats] = useState({ accounts: 0, relatives: 0 });
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const carouselRef = useRef(null);
  const [isTapeHovered, setIsTapeHovered] = useState(false);
  const [summaryDisplay, setSummaryDisplay] = useState({ accounts: 0, relatives: 0, rels: 0 });
  const [summaryTrend, setSummaryTrend] = useState(false);
  const summaryAnimRef = useRef(0);
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [feedRetry, setFeedRetry] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [s, persons, tree] = await Promise.all([
          apiGet("/api/stats"),
          apiGet("/api/persons"),
          apiGet("/api/tree"),
        ]);
        setGlobalStats({
          accounts: s?.userCount ?? 0,
          relatives: (persons || []).filter((p) => !p.isPlaceholder).length || s?.personCount || 0,
        });
        setPeople((persons || []).filter((p) => !p.isPlaceholder));
        setRelationships(tree?.relationships || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFeedLoading(true);
      setFeedError("");
      try {
        const data = await apiGet("/api/home/feed");
        if (!cancelled) {
          setFeedItems(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (e) {
        if (!cancelled) {
          setFeedError(e?.message || String(e));
          setFeedItems([]);
        }
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feedRetry]);

  const summaryTargets = useMemo(
    () => ({
      accounts: globalStats.accounts,
      relatives: globalStats.relatives,
      rels: relationships.length,
    }),
    [globalStats.accounts, globalStats.relatives, relationships.length],
  );

  useEffect(() => {
    if (location.pathname.replace(/\/$/, "") !== "/app/home") return;

    const id = ++summaryAnimRef.current;
    const { accounts: toA, relatives: toR, rels: toRel } = summaryTargets;
    const duration = 1500;
    let raf = 0;
    let start = null;
    setSummaryTrend(false);

    const tick = (now) => {
      if (summaryAnimRef.current !== id) return;
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      setSummaryDisplay({
        accounts: Math.round(toA * e),
        relatives: Math.round(toR * e),
        rels: Math.round(toRel * e),
      });
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setSummaryDisplay({ accounts: toA, relatives: toR, rels: toRel });
        const any = toA > 0 || toR > 0 || toRel > 0;
        if (any) {
          window.setTimeout(() => {
            if (summaryAnimRef.current === id) setSummaryTrend(true);
          }, 80);
        }
      }
    };

    setSummaryDisplay({ accounts: 0, relatives: 0, rels: 0 });
    raf = requestAnimationFrame(tick);
    return () => {
      summaryAnimRef.current += 1;
      cancelAnimationFrame(raf);
    };
  }, [location.pathname, summaryTargets]);

  const relativesForTape = useMemo(() => {
    const arr = [...people];
    arr.sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      const ya = toYear(a.birthDate) || 3000;
      const yb = toYear(b.birthDate) || 3000;
      return ya - yb;
    });
    return arr.slice(0, 18);
  }, [people]);
  const relativesTapeLoop = useMemo(() => {
    if (relativesForTape.length === 0) return [];
    return [...relativesForTape, ...relativesForTape];
  }, [relativesForTape]);
  const updates = useMemo(() => {
    return [...people]
      .filter((p) => p.birthDate || p.notes || p.birthCity || p.birthCityCustom)
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        title: fullName(p),
        text: p.notes?.trim()
          ? p.notes.trim().slice(0, 120)
          : `Новая карточка: ${p.birthCityCustom || p.birthCity || "город не указан"}, ${
              p.birthDate ? `р. ${p.birthDate}` : "дата не указана"
            }.`,
      }));
  }, [people]);

  const scrollTape = (dir) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.65), behavior: "smooth" });
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || relativesForTape.length <= 1) return;
    const id = setInterval(() => {
      if (isTapeHovered) return;
      const half = el.scrollWidth / 2;
      const atEnd = el.scrollLeft >= half - 6;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      el.scrollBy({ left: Math.max(160, el.clientWidth * 0.32), behavior: "smooth" });
    }, 2600);
    return () => clearInterval(id);
  }, [relativesForTape.length, isTapeHovered]);

  return (
    <div className="home-shell home-portal -mx-4 space-y-8 md:-mx-6 md:space-y-10">
      <section className="home-hero home-portal-hero px-4 py-9 md:px-6 md:py-11">
        <div className="home-portal-grid">
          <div className="space-y-5">
            <Badge variant="secondary" className="home-pill home-portal-kicker">
              Официальная семейная летопись
            </Badge>
            <h1 className="home-title home-portal-title">
              {user?.firstName ? `${user.firstName}, запишите историю своей семьи` : "Запишите историю своей семьи"}
            </h1>
            <p className="home-subtitle home-portal-subtitle">
              Создавайте семейный архив: фиксируйте биографии, связи поколений, документы и города, чтобы память о
              ваших близких оставалась живой.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild className="home-portal-cta">
                <Link to="/app/relatives">Записать историю</Link>
              </Button>
              <Button asChild variant="outline" className="home-portal-cta-alt">
                <Link to="/app/tree">Открыть древо</Link>
              </Button>
            </div>
          </div>

          <div className="home-portal-summary">
            <p className="home-portal-summary-title">Сводка летописи</p>
            <div className="home-portal-summary-grid">
              <div className="home-portal-stat-card">
                <div className="home-portal-stat-value-row">
                  <strong className="home-portal-stat-value tabular-nums">{summaryDisplay.accounts}</strong>
                  {summaryTrend && summaryTargets.accounts > 0 ? (
                    <TrendingUp className="home-portal-stat-trend" aria-hidden strokeWidth={2.5} />
                  ) : null}
                </div>
                <span className="home-portal-stat-label">семей в системе</span>
              </div>
              <div className="home-portal-stat-card">
                <div className="home-portal-stat-value-row">
                  <strong className="home-portal-stat-value tabular-nums">{summaryDisplay.relatives}</strong>
                  {summaryTrend && summaryTargets.relatives > 0 ? (
                    <TrendingUp className="home-portal-stat-trend" aria-hidden strokeWidth={2.5} />
                  ) : null}
                </div>
                <span className="home-portal-stat-label">человек в базе</span>
              </div>
              <div className="home-portal-stat-card">
                <div className="home-portal-stat-value-row">
                  <strong className="home-portal-stat-value tabular-nums">{summaryDisplay.rels}</strong>
                  {summaryTrend && summaryTargets.rels > 0 ? (
                    <TrendingUp className="home-portal-stat-trend" aria-hidden strokeWidth={2.5} />
                  ) : null}
                </div>
                <span className="home-portal-stat-label">связей поколений</span>
              </div>
            </div>
            <p className="home-portal-summary-note">
              Данные автоматически обновляются по мере добавления новых карточек родственников.
            </p>
          </div>
        </div>
      </section>

      <Separator className="opacity-50" />

      <section className="px-4 md:px-6">
        <div className="home-section-band home-section-band--surface">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="home-section-title home-portal-section-title">Лента родственников</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="home-portal-arrow" onClick={() => scrollTape(-1)}>
              ←
            </Button>
            <Button variant="outline" size="sm" className="home-portal-arrow" onClick={() => scrollTape(1)}>
              →
            </Button>
          </div>
        </div>
        <div
          className="home-relatives-tape"
          ref={carouselRef}
          onMouseEnter={() => setIsTapeHovered(true)}
          onMouseLeave={() => setIsTapeHovered(false)}
        >
          {relativesTapeLoop.map((p, idx) => (
            <Card key={`${p.id}-${idx}`} className="home-relative-card">
              <CardHeader>
                <div className="home-relative-avatar">{initials(p)}</div>
                <div className="space-y-1">
                  <CardTitle className="text-base">{fullName(p)}</CardTitle>
                  <CardDescription>
                    {p.birthDate ? `р. ${p.birthDate}` : "дата не указана"}
                    {" · "}
                    {p.birthCityCustom || p.birthCity || "город не указан"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Badge variant={p.isSelf ? "default" : "outline"}>{p.isSelf ? "Вы" : "Родственник"}</Badge>
              </CardContent>
            </Card>
          ))}
          {relativesForTape.length === 0 ? (
            <Card className="home-relative-card">
              <CardHeader>
                <CardTitle className="text-base">Пока нет родственников</CardTitle>
                <CardDescription>Добавьте первую карточку, чтобы лента начала заполняться.</CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </div>
        </div>
      </section>

      <Separator className="opacity-50" />

      <section className="px-4 md:px-6">
        <div className="home-section-band home-section-band--muted">
          <h2 className="home-section-title home-portal-section-title mb-1">Интересные факты о вашем роде</h2>
          <p className="text-muted-foreground mb-4 max-w-3xl text-sm leading-relaxed">
            Сводка по вашей летописи, пересечения с эпохами и иллюстрации из статей{" "}
            <a href="https://ru.ruwiki.ru" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              РУВИКИ
            </a>
            . Лента медленно прокручивается; наведите курсор, чтобы остановить.
          </p>
          <HomeFactsMarquee
            items={feedItems}
            loading={feedLoading}
            error={feedError}
            onRetry={() => setFeedRetry((n) => n + 1)}
          />
        </div>
      </section>

      <Separator className="opacity-50" />

      <section className="px-4 md:px-6">
        <div className="home-section-band home-section-band--muted">
        <h2 className="home-section-title home-portal-section-title mb-3">Разделы семейного пространства</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/app/relatives">
            <Card className="home-nav-card">
              <CardHeader>
                <CardTitle className="text-base">Родственники</CardTitle>
                <CardDescription>Карточки людей, биография, документы и связи по поколениям.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link to="/app/tree">
            <Card className="home-nav-card">
              <CardHeader>
                <CardTitle className="text-base">Интерактивное древо</CardTitle>
                <CardDescription>Визуальная структура рода с акцентом на линиях семьи.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link to="/app/map">
            <Card className="home-nav-card">
              <CardHeader>
                <CardTitle className="text-base">Карта предков</CardTitle>
                <CardDescription>Города рождения, захоронения и маршруты переселений семьи.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link to="/app/profile">
            <Card className="home-nav-card">
              <CardHeader>
                <CardTitle className="text-base">Ваш профиль</CardTitle>
                <CardDescription>Личные данные, доступ, безопасность и управление учётной записью.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
        </div>
      </section>

      <Separator className="opacity-50" />

      <section className="px-4 pb-2 md:px-6">
        <div className="home-section-band home-section-band--surface pb-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="home-section-title home-portal-section-title">Обновления семейной летописи</h2>
          <Link className="home-section-link home-portal-link" to="/app/relatives">
            Открыть все профили
          </Link>
        </div>
        {updates.length > 0 ? (
          <div className="home-updates-marquee">
            <div className="home-updates-track">
              {[...updates, ...updates].map((u, i) => (
                <Card key={`${u.id}-${i}`} className="home-updates-card">
                  <CardHeader>
                    <CardTitle className="text-base">{u.title}</CardTitle>
                    <CardDescription>{u.text}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Пока нет обновлений</CardTitle>
              <CardDescription>После заполнения карточек родственников здесь появятся новости летописи.</CardDescription>
            </CardHeader>
          </Card>
        )}
        </div>
      </section>
    </div>
  );
}
