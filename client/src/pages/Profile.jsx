import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api.js";
import { CITY_OPTIONS } from "../data/cities.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16 text-lg">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {p.firstName} {p.lastName}
          </h1>
          <p className="text-muted-foreground text-sm">Центральный узел вашего древа</p>
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
          <CardDescription>Личные данные и место рождения</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pf-first">Имя</Label>
              <Input id="pf-first" value={p.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-last">Фамилия</Label>
              <Input id="pf-last" value={p.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-email">Электронная почта</Label>
              <Input id="pf-email" type="email" value={p.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-phone">Телефон</Label>
              <Input id="pf-phone" value={p.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-login">Логин</Label>
              <Input id="pf-login" value={p.login} onChange={(e) => set("login", e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pf-sex">Пол</Label>
              <select
                id="pf-sex"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
                value={p.sex}
                onChange={(e) => set("sex", e.target.value)}
              >
                <option value="">Не указан</option>
                <option value="M">Мужской</option>
                <option value="F">Женский</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-birth">Дата рождения</Label>
              <Input id="pf-birth" type="date" value={p.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Место рождения</Label>
              <div className="flex gap-2">
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
              </div>
              {birthMode === "list" ? (
                <select
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-2 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
                  value={p.birthCity}
                  onChange={(e) => set("birthCity", e.target.value)}
                >
                  <option value="">Не выбрано</option>
                  {CITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className="mt-2"
                  value={p.birthCityCustom}
                  onChange={(e) => set("birthCityCustom", e.target.value)}
                  placeholder="Например: Тула"
                />
              )}
            </div>
            <Button className="mt-4 w-full md:w-auto" onClick={save} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
