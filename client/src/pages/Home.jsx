import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

function generateFacts(persons, relationships, mePersonId) {
  const relatives = (persons || []).filter((p) => !p.isPlaceholder);
  const years = relatives.map((p) => toYear(p.birthDate)).filter(Boolean);
  const cityCounter = new Map();
  for (const p of relatives) {
    const city = (p.birthCityCustom || p.birthCity || "").trim();
    if (!city) continue;
    cityCounter.set(city, (cityCounter.get(city) || 0) + 1);
  }
  const topCity = [...cityCounter.entries()].sort((a, b) => b[1] - a[1])[0];

  const adj = new Map();
  const add = (a, b) => {
    if (!a || !b || a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  };
  for (const r of relationships || []) add(r.basePersonId, r.relatedPersonId);

  const bfs = (start) => {
    const q = [start];
    const dist = new Map([[start, 0]]);
    while (q.length) {
      const cur = q.shift();
      for (const n of adj.get(cur) || []) {
        if (dist.has(n)) continue;
        dist.set(n, (dist.get(cur) || 0) + 1);
        q.push(n);
      }
    }
    return dist;
  };

  let depth = 0;
  if (mePersonId) {
    const d = bfs(mePersonId);
    for (const v of d.values()) depth = Math.max(depth, v);
  }

  let longest = 0;
  const ids = relatives.map((p) => p.id).filter(Boolean);
  for (const id of ids) {
    const d = bfs(id);
    for (const v of d.values()) longest = Math.max(longest, v);
  }

  const paternal = (relationships || []).filter((r) => String(r.relationType).toLowerCase() === "отец").length;
  const maternal = (relationships || []).filter((r) => String(r.relationType).toLowerCase() === "мать").length;

  const facts = [
    {
      key: "generations",
      title: "Глубина древа",
      value: depth ? `${depth + 1} поколений` : "н/д",
      hint: "Количество уровней от вашего узла.",
    },
    {
      key: "timeline",
      title: "Временной диапазон",
      value: years.length ? `${Math.min(...years)} — ${Math.max(...years)}` : "н/д",
      hint: "Диапазон годов рождения в семейной базе.",
    },
    {
      key: "city",
      title: "Центральный город рода",
      value: topCity ? `${topCity[0]} (${topCity[1]})` : "н/д",
      hint: "Город, который чаще других встречается в карточках.",
    },
    {
      key: "branch",
      title: "Самая длинная ветка",
      value: longest ? `${longest + 1} человек` : "н/д",
      hint: "Максимальная длина цепочки родства по графу.",
    },
    {
      key: "line",
      title: "Отцовская / материнская линия",
      value: `${paternal} / ${maternal}`,
      hint: "Количество явно отмеченных связей «отец» и «мать».",
    },
  ];
  return facts;
}

export default function Home({ user }) {
  const [globalStats, setGlobalStats] = useState({ accounts: 0, relatives: 0 });
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [mePersonId, setMePersonId] = useState("");
  const carouselRef = useRef(null);

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
        setMePersonId(tree?.mePersonId || "");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const facts = useMemo(() => generateFacts(people, relationships, mePersonId), [people, relationships, mePersonId]);
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

  return (
    <div className="home-shell home-memorial -mx-4 space-y-10 md:-mx-6">
      <section className="home-hero home-memorial-hero px-4 py-9 md:px-6 md:py-12">
        <div className="home-memorial-grid">
          <div className="space-y-5">
            <Badge variant="secondary" className="home-pill">
              Летопись семьи
            </Badge>
            <h1 className="home-title home-memorial-title">
              {user?.firstName ? `${user.firstName}, ваши предки должны идти строем памяти` : "Они должны идти строем памяти"}
            </h1>
            <p className="home-subtitle">
              Цифровая семейная летопись: сохраняйте истории, показывайте поколения, собирайте документы и
              географию жизни ваших родственников.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/app/relatives">Записать историю</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/tree">Открыть древо</Link>
              </Button>
            </div>
            <div className="home-memorial-stats">
              <div><strong>{globalStats.accounts}</strong><span>семей</span></div>
              <div><strong>{globalStats.relatives}</strong><span>человек в базе</span></div>
              <div><strong>{relationships.length}</strong><span>связей поколений</span></div>
            </div>
          </div>
          <Card className="home-search-card">
            <CardHeader>
              <CardTitle>Навигация по архиву</CardTitle>
              <CardDescription>Переходите в ключевые разделы платформы.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/app/relatives">Родственники</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/app/map">Карта</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/app/tree">Древо</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/app/profile">Профиль</Link></Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-4 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="home-section-title">Лента родственников</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => scrollTape(-1)}>←</Button>
            <Button variant="outline" size="sm" onClick={() => scrollTape(1)}>→</Button>
          </div>
        </div>
        <div className="home-relatives-tape" ref={carouselRef}>
          {relativesForTape.map((p) => (
            <Card key={p.id} className="home-relative-card">
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
      </section>

      <section className="px-4 md:px-6">
        <h2 className="home-section-title mb-3">Интересные факты о вашем роде</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {facts.map((fact) => (
            <Card key={fact.key} className="home-story-card">
              <CardHeader>
                <CardDescription>{fact.title}</CardDescription>
                <CardTitle className="text-2xl">{fact.value}</CardTitle>
                <CardDescription>{fact.hint}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 md:px-6">
        <h2 className="home-section-title mb-3">Разделы семейного пространства</h2>
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
      </section>

      <section className="px-4 pb-2 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="home-section-title">Обновления семейной летописи</h2>
          <Link className="home-section-link" to="/app/relatives">Открыть все профили</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {updates.map((u) => (
            <Card key={u.id}>
              <CardHeader>
                <CardTitle className="text-base">{u.title}</CardTitle>
                <CardDescription>{u.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
          {updates.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Пока нет обновлений</CardTitle>
                <CardDescription>После заполнения карточек родственников здесь появятся новости летописи.</CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
