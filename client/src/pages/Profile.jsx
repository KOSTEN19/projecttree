import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../api.js";
import { CITY_OPTIONS } from "../data/cities.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";

const EMPTY = "__none__";

function profileCompletenessPercent(p, birthMode) {
  const geoOk =
    birthMode === "list"
      ? Boolean(String(p?.birthCity || "").trim())
      : Boolean(String(p?.birthCityCustom || "").trim());
  const bits = [
    String(p?.firstName || "").trim(),
    String(p?.lastName || "").trim(),
    String(p?.email || "").trim(),
    String(p?.phone || "").trim(),
    String(p?.login || "").trim(),
    String(p?.sex || "").trim(),
    String(p?.birthDate || "").trim(),
    geoOk,
  ];
  const n = bits.filter(Boolean).length;
  return Math.round((n / bits.length) * 100);
}

export default function Profile({ onProfileUpdated }) {
  const [p, setP] = useState(null);
  const [birthMode, setBirthMode] = useState("list");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await apiGet("/api/profile");
      setP(data);
      setBirthMode(data.birthCityCustom ? "custom" : "list");
    })();
  }, []);

  function set(k, v) {
    setP((x) => ({ ...x, [k]: v }));
  }

  async function save() {
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const payload = { ...p };
      if (birthMode === "list") payload.birthCityCustom = "";
      else payload.birthCity = "";
      await apiPut("/api/profile", payload);
      setOk("Данные сохранены");
      onProfileUpdated?.();
      setTimeout(() => setOk(""), 3000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const pct = useMemo(() => (p ? profileCompletenessPercent(p, birthMode) : 0), [p, birthMode]);

  if (!p) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const initials = ((p.firstName || "?")[0] + (p.lastName || "")[0]).toUpperCase();
  const displayName = [p.lastName, p.firstName].filter(Boolean).join(" ").trim() || "Профиль";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {err && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      {ok && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{ok}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden border-border/80">
        <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center">
          <Avatar className="size-20 text-xl sm:size-24">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
              <Badge variant="secondary">Центральный узел древа</Badge>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Эти данные видны вам и в семейной летописи; заполните профиль — так проще строить связи и карту рода.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Progress value={pct} className="w-full flex-col gap-2">
          <div className="flex w-full items-baseline justify-between gap-3">
            <ProgressLabel>Заполненность профиля</ProgressLabel>
            <ProgressValue>{pct}%</ProgressValue>
          </div>
        </Progress>
        <p className="text-muted-foreground text-xs">Учитываются имя, контакты, пол, дата и место рождения.</p>
      </div>

      <Tabs defaultValue="personal" className="gap-4">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-0 sm:flex-nowrap">
          <TabsTrigger value="personal" className="flex-none">
            Личные данные
          </TabsTrigger>
          <TabsTrigger value="geo" className="flex-none">
            Родство и география
          </TabsTrigger>
          <TabsTrigger value="account" className="flex-none">
            Учётная запись
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-0 space-y-0">
          <Card>
            <CardHeader>
              <CardTitle>Личные данные</CardTitle>
              <CardDescription>Имя и основные сведения, как в семейных карточках.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-6">
                <Field>
                  <FieldLabel htmlFor="pf-first">Имя</FieldLabel>
                  <FieldContent>
                    <Input id="pf-first" value={p.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-last">Фамилия</FieldLabel>
                  <FieldContent>
                    <Input id="pf-last" value={p.lastName} onChange={(e) => set("lastName", e.target.value)} />
                  </FieldContent>
                </Field>
                <Separator />
                <Field>
                  <FieldLabel htmlFor="pf-sex">Пол</FieldLabel>
                  <FieldContent>
                    <Select
                      value={p.sex ? p.sex : EMPTY}
                      onValueChange={(v) => set("sex", v === EMPTY ? "" : v)}
                    >
                      <SelectTrigger id="pf-sex" className="w-full max-w-md">
                        <SelectValue placeholder="Не указан" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value={EMPTY}>Не указан</SelectItem>
                        <SelectItem value="M">Мужской</SelectItem>
                        <SelectItem value="F">Женский</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-birth">Дата рождения</FieldLabel>
                  <FieldContent>
                    <Input
                      id="pf-birth"
                      type="date"
                      className="max-w-md"
                      value={p.birthDate}
                      onChange={(e) => set("birthDate", e.target.value)}
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geo" className="mt-0 space-y-0">
          <Card>
            <CardHeader>
              <CardTitle>Родство и география</CardTitle>
              <CardDescription>Город рождения используется на карте предков и в сводках.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-6">
                <Field>
                  <FieldLabel>Место рождения</FieldLabel>
                  <FieldDescription>Выберите город из списка или введите вручную.</FieldDescription>
                  <FieldContent className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={birthMode === "list" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setBirthMode("list")}
                    >
                      Из списка
                    </Button>
                    <Button
                      type="button"
                      variant={birthMode === "custom" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setBirthMode("custom")}
                    >
                      Вручную
                    </Button>
                  </FieldContent>
                </Field>
                {birthMode === "list" ? (
                  <Field>
                    <FieldLabel htmlFor="pf-city">Город</FieldLabel>
                    <FieldContent>
                      <Select
                        value={p.birthCity ? p.birthCity : EMPTY}
                        onValueChange={(v) => set("birthCity", v === EMPTY ? "" : v)}
                      >
                        <SelectTrigger id="pf-city" className="w-full">
                          <SelectValue placeholder="Не выбрано" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={EMPTY}>Не выбрано</SelectItem>
                          {CITY_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="pf-city-custom">Город (вручную)</FieldLabel>
                    <FieldContent>
                      <Input
                        id="pf-city-custom"
                        value={p.birthCityCustom}
                        onChange={(e) => set("birthCityCustom", e.target.value)}
                        placeholder="Например: Тула"
                      />
                    </FieldContent>
                  </Field>
                )}
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-0 space-y-0">
          <Card>
            <CardHeader>
              <CardTitle>Учётная запись</CardTitle>
              <CardDescription>Контакты и имя входа. Почта может использоваться для восстановления доступа.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-6">
                <Field>
                  <FieldLabel htmlFor="pf-email">Электронная почта</FieldLabel>
                  <FieldContent>
                    <Input id="pf-email" type="email" value={p.email} onChange={(e) => set("email", e.target.value)} />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-phone">Телефон</FieldLabel>
                  <FieldContent>
                    <Input id="pf-phone" value={p.phone} onChange={(e) => set("phone", e.target.value)} />
                  </FieldContent>
                </Field>
                <Separator />
                <Field>
                  <FieldLabel htmlFor="pf-login">Логин</FieldLabel>
                  <FieldContent>
                    <Input id="pf-login" value={p.login} onChange={(e) => set("login", e.target.value)} />
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end border-t border-border/60 pt-4">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </Button>
      </div>
    </div>
  );
}
