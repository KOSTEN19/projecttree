import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home({ user }) {
  const [globalStats, setGlobalStats] = useState({ accounts: 0, relatives: 0 });

  useEffect(() => {
    (async () => {
      try {
        const s = await apiGet("/api/stats");
        setGlobalStats({
          accounts: s?.userCount ?? 0,
          relatives: s?.personCount ?? 0,
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const stories = [
    {
      title: "Ветка рода по линии бабушки",
      subtitle: "Собрали 4 поколения и восстановили утраченные связи.",
      city: "Казань",
      tag: "История семьи",
    },
    {
      title: "Семейный архив документов",
      subtitle: "Добавлены метрики, биографии и ссылки на источники.",
      city: "Москва",
      tag: "Архив",
    },
    {
      title: "География переселений",
      subtitle: "Карта показывает путь семьи по городам и эпохам.",
      city: "Самара",
      tag: "Карта рода",
    },
  ];

  return (
    <div className="home-shell -mx-4 space-y-8 md:-mx-6">
      <section className="home-hero px-4 py-8 md:px-6 md:py-10">
        <div className="home-hero-grid">
          <div className="space-y-5">
            <Badge variant="secondary" className="home-pill">
              Семейная летопись и родовое древо
            </Badge>
            <h1 className="home-title">
              {user?.firstName ? `${user.firstName}, сохраняйте память рода` : "Сохраняйте память о предках"}
            </h1>
            <p className="home-subtitle">
              Объединяйте поколения в одном пространстве: добавляйте родственников, восстанавливайте связи,
              собирайте документы и отслеживайте географию семьи.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/app/relatives">Добавить родственника</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/tree">Открыть древо</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">Семей: {globalStats.accounts}</Badge>
              <Badge variant="secondary">Родственников: {globalStats.relatives}</Badge>
              <Badge variant="outline">Архив рода</Badge>
            </div>
          </div>

          <Card className="home-search-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Быстрый старт по семье</CardTitle>
              <CardDescription>
                Найдите человека в базе или перейдите в раздел для заполнения карточек.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Фамилия, имя или город рождения" />
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/relatives">Профили</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/map">Карта рода</Link>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Поиск в интерфейсе используется как навигационный блок главной страницы.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-4 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="home-section-title">Истории и ветви семьи</h2>
          <Link className="home-section-link" to="/app/relatives">Открыть все профили</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {stories.map((story) => (
            <Card key={story.title} className="home-story-card">
              <CardHeader>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge variant="outline">{story.tag}</Badge>
                  <span className="text-muted-foreground text-xs">{story.city}</span>
                </div>
                <CardTitle className="text-base">{story.title}</CardTitle>
                <CardDescription>{story.subtitle}</CardDescription>
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
        <h2 className="home-section-title mb-3">Как мы ведём семейный архив</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Точность данных</CardTitle>
              <CardDescription>ФИО, даты и города фиксируем с указанием источников и семейных комментариев.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Документы и фото</CardTitle>
              <CardDescription>Храним биографии, фотографии, внешние ссылки и важные семейные истории.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Связи поколений</CardTitle>
              <CardDescription>Собираем полную картину рода: от прямой линии до боковых ветвей.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  );
}
