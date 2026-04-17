import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { apiGet, apiPost } from "../api.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const navigate = useNavigate();
  const [globalStats, setGlobalStats] = useState({ accounts: 0, relatives: 0, rels: 0 });
  const [people, setPeople] = useState([]);
  const [summaryDisplay, setSummaryDisplay] = useState({ accounts: 0, relatives: 0, rels: 0 });
  const [summaryTrend, setSummaryTrend] = useState(false);
  const summaryAnimRef = useRef(0);
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [feedRetry, setFeedRetry] = useState(0);
  const [feedAiPending, setFeedAiPending] = useState(false);
  const [feedAiBusy, setFeedAiBusy] = useState(false);
  const [factDetails, setFactDetails] = useState(null);
  const [updateDetails, setUpdateDetails] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, persons] = await Promise.all([apiGet("/api/stats"), apiGet("/api/persons")]);
        setGlobalStats({
          accounts: s?.userCount ?? 0,
          relatives: Number(s?.personCount) || 0,
          rels: Number(s?.relationshipCount) || 0,
        });
        setPeople((persons || []).filter((p) => !p.isPlaceholder));
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
          setFeedAiPending(Boolean(data?.aiPending));
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

  useEffect(() => {
    const st = location.state;
    if (!st?.refreshHomeFeed && !st?.aiFeedQueued) return;
    setFeedRetry((n) => n + 1);
    navigate(".", { replace: true, state: {} });
  }, [location.state, navigate]);

  async function refreshAIFeed() {
    setFeedAiBusy(true);
    try {
      await apiPost("/api/ai/feed/refresh", {});
      setFeedRetry((n) => n + 1);
    } catch {
    } finally {
      setFeedAiBusy(false);
    }
  }

  const summaryTargets = useMemo(
    () => ({
      accounts: globalStats.accounts,
      relatives: globalStats.relatives,
      rels: globalStats.rels,
    }),
    [globalStats.accounts, globalStats.relatives, globalStats.rels],
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
        personId: p.id,
        title: fullName(p),
        text: p.notes?.trim()
          ? p.notes.trim().slice(0, 120)
          : `Новая карточка: ${p.birthCityCustom || p.birthCity || "город не указан"}, ${
              p.birthDate ? `р. ${p.birthDate}` : "дата не указана"
            }.`,
      }));
  }, [people]);

  function openRelativeInFamily(personId) {
    navigate("/app/relatives", { state: { focusPersonId: personId } });
  }

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
              Цифры по всей платформе: учётные записи, карточки людей и связи между ними во всех семьях.
            </p>
          </div>
        </div>
      </section>

      <Separator className="opacity-50" />

      <section className="px-4 md:px-6">
        <div className="home-section-band home-section-band--surface">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="home-section-title home-portal-section-title">Лента родственников</h2>
          <Link className="home-section-link home-portal-link" to="/app/relatives">
            Все родственники
          </Link>
        </div>
        {relativesForTape.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Пока нет родственников</CardTitle>
              <CardDescription>Добавьте первую карточку, чтобы лента начала заполняться.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="home-relatives-marquee">
            <div className="home-relatives-track">
              {relativesTapeLoop.map((p, idx) => (
                <div
                  key={`${p.id}-${idx}`}
                  className="home-relative-ticker-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openRelativeInFamily(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openRelativeInFamily(p.id);
                    }
                  }}
                >
                  <div className="home-relative-ticker-row">
                    <div className="home-relative-ticker-avatar" aria-hidden>
                      {initials(p)}
                    </div>
                    <div className="home-relative-ticker-main">
                      <div className="home-relative-ticker-name">{fullName(p)}</div>
                      <div className="home-relative-ticker-meta">
                        {p.birthDate ? `р. ${p.birthDate}` : "дата не указана"}
                        {" · "}
                        {p.birthCityCustom || p.birthCity || "город не указан"}
                      </div>
                    </div>
                    <Badge className="shrink-0" variant={p.isSelf ? "default" : "outline"}>
                      {p.isSelf ? "Вы" : "Родственник"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </section>

      <Separator className="opacity-50" />

      <section className="px-4 md:px-6">
        <div className="home-section-band home-section-band--muted">
          <h2 className="home-section-title home-portal-section-title mb-1">Интересные факты о вашем роде</h2>
          <p className="text-muted-foreground mb-3 max-w-3xl text-sm leading-relaxed">
            Сводка по вашей летописи, пересечения с эпохами и иллюстрации из статей{" "}
            <a href="https://ru.ruwiki.ru" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              РУВИКИ
            </a>
            . При включённом ИИ на сервере сюда добавляются короткие формулировки по вашим данным (локальная или облачная модель).
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={feedAiBusy || feedLoading}
              onClick={() => void refreshAIFeed()}
            >
              {feedAiBusy ? "Запрос…" : "Обновить факты (ИИ)"}
            </Button>
            {feedAiPending ? (
              <span className="text-muted-foreground text-xs">Подготовка ИИ-формулировок… Обновите страницу через минуту.</span>
            ) : null}
          </div>
          <HomeFactsMarquee
            items={feedItems}
            loading={feedLoading}
            error={feedError}
            onRetry={() => setFeedRetry((n) => n + 1)}
            onItemClick={setFactDetails}
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
                <Card
                  key={`${u.id}-${i}`}
                  className="home-updates-card cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => setUpdateDetails(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setUpdateDetails(u);
                    }
                  }}
                >
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

      <Dialog open={Boolean(factDetails)} onOpenChange={(open) => !open && setFactDetails(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{factDetails?.headline || "Интересный факт"}</DialogTitle>
            <DialogDescription>
              {factDetails?.kind === "era" ? "Эпоха и род" : factDetails?.kind === "ai" ? "ИИ-формулировка" : "Факт по вашей летописи"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed">{factDetails?.body || ""}</p>
            {factDetails?.sourceUrl ? (
              <a
                className="text-primary text-sm underline underline-offset-2"
                href={factDetails.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {factDetails.sourceLabel || "Открыть источник"}
              </a>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(updateDetails)} onOpenChange={(open) => !open && setUpdateDetails(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{updateDetails?.title || "Обновление летописи"}</DialogTitle>
            <DialogDescription>Детали обновления карточки родственника</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed">{updateDetails?.text || ""}</p>
            {updateDetails?.personId ? (
              <Button type="button" onClick={() => openRelativeInFamily(updateDetails.personId)}>
                Открыть в разделе «Семья»
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
