import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { apiGet, apiPost, apiPut } from "../api.js";
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
import { showApiError } from "@/lib/apiErrorSink.js";
import {
  PHONE_ALLOWED_PATTERN,
  PHONE_TITLE,
  sanitizePhoneInput,
  validatePhoneClient,
} from "@/lib/validationFields.js";

const EMPTY = "__none__";

function profileCompletenessPercent(p) {
  const geoOk = Boolean(String(p?.birthCityCustom || p?.birthCity || "").trim());
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

function filterLocalCities(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return CITY_OPTIONS.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
}

export default function Profile({ onProfileUpdated }) {
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [remoteCitySuggestions, setRemoteCitySuggestions] = useState([]);
  const [cityListOpen, setCityListOpen] = useState(false);
  const cityWrapRef = useRef(null);
  const cityInputRef = useRef(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdOk, setPwdOk] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [aiFeedBusy, setAiFeedBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await apiGet("/api/profile");
      const merged = {
        ...data,
        phone: sanitizePhoneInput(data.phone || ""),
        birthCityCustom: String(data.birthCityCustom || data.birthCity || "").trim(),
        birthCity: "",
      };
      setP(merged);
    })();
  }, []);

  useEffect(() => {
    const q = String(p?.birthCityCustom || "").trim();
    if (q.length < 3) {
      setRemoteCitySuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const d = await apiGet(`/api/geo/suggest?q=${encodeURIComponent(q)}&limit=8`);
        if (!cancelled) setRemoteCitySuggestions(Array.isArray(d?.items) ? d.items : []);
      } catch {
        if (!cancelled) setRemoteCitySuggestions([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [p?.birthCityCustom]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!cityWrapRef.current?.contains(e.target)) setCityListOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function setField(k, v) {
    setP((x) => ({ ...x, [k]: v }));
  }

  const localCitySuggestions = useMemo(
    () => filterLocalCities(p?.birthCityCustom),
    [p?.birthCityCustom]
  );

  const citySuggestions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of [...localCitySuggestions, ...remoteCitySuggestions]) {
      const t = String(s || "").trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= 12) break;
    }
    return out;
  }, [localCitySuggestions, remoteCitySuggestions]);

  async function save() {
    setOk("");
    const phoneErr = validatePhoneClient(p.phone);
    if (phoneErr) {
      showApiError(phoneErr);
      return;
    }
    if (!String(p.firstName || "").trim() || !String(p.lastName || "").trim()) {
      showApiError("Имя и фамилия обязательны.");
      return;
    }
    setSaving(true);
    try {
      await apiPut("/api/profile", {
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        sex: p.sex,
        birthDate: p.birthDate,
        birthCity: "",
        birthCityCustom: String(p.birthCityCustom || "").trim(),
      });
      setOk("Данные сохранены");
      onProfileUpdated?.();
      setTimeout(() => setOk(""), 3000);
    } catch {
      /* диалог из api.js */
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    setPwdOk("");
    if (!currentPassword || !newPassword) {
      showApiError("Заполните текущий и новый пароль.");
      return;
    }
    if (newPassword.length < 8) {
      showApiError("Новый пароль: не менее 8 символов.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showApiError("Новый пароль и подтверждение не совпадают.");
      return;
    }
    setSavingPwd(true);
    try {
      await apiPut("/api/profile/password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwdOk("Пароль обновлён");
      setTimeout(() => setPwdOk(""), 4000);
    } catch {
      /* диалог */
    } finally {
      setSavingPwd(false);
    }
  }

  async function runAiFeedAnalysis() {
    setAiFeedBusy(true);
    try {
      await apiPost("/api/ai/feed/refresh", {});
      navigate("/app/home", { state: { refreshHomeFeed: true, aiFeedQueued: true } });
    } catch {
      /* глобальный диалог из api.js */
    } finally {
      setAiFeedBusy(false);
    }
  }

  const pct = useMemo(() => (p ? profileCompletenessPercent(p) : 0), [p]);

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
  const qTrim = String(p.birthCityCustom || "").trim();
  const showCityDropdown =
    cityListOpen && citySuggestions.length > 0 && citySuggestions.some((s) => s !== qTrim);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {(ok || pwdOk) && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{ok || pwdOk}</AlertDescription>
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

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Интересные факты о роде</CardTitle>
          <CardDescription>
            На главной в блоке «Интересные факты о вашем роде» могут появляться короткие формулировки по вашим
            родственникам и связям (если на сервере включён ИИ). Нажмите кнопку — сервер поставит принудительный пересчёт,
            затем откроется главная; карточки с пометкой «ИИ» подгрузятся через короткое время (при лимите запросов
            подождите минуту).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2 sm:w-auto"
            disabled={aiFeedBusy}
            onClick={() => void runAiFeedAnalysis()}
          >
            <Sparkles className="size-4 opacity-80" aria-hidden />
            {aiFeedBusy ? "Запрос…" : "Запустить анализ ИИ для главной"}
          </Button>
          <p className="text-muted-foreground text-xs sm:max-w-xs sm:text-right">
            Если ИИ отключён на сервере, появится сообщение об ошибке.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal" className="gap-4 overflow-visible">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-0 sm:flex-nowrap">
          <TabsTrigger value="personal" className="flex-none">
            Личные данные
          </TabsTrigger>
          <TabsTrigger value="account" className="flex-none">
            Учётная запись
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-0 space-y-0 overflow-visible">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle>Личные данные</CardTitle>
              <CardDescription>Имя, пол, дата и город рождения (город вводите вручную; подсказки — из справочника и поиска).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-visible">
              <FieldGroup className="gap-6 overflow-visible">
                <Field>
                  <FieldLabel htmlFor="pf-first">Имя</FieldLabel>
                  <FieldContent>
                    <Input
                      id="pf-first"
                      required
                      minLength={1}
                      maxLength={120}
                      autoComplete="given-name"
                      value={p.firstName}
                      onChange={(e) => setField("firstName", e.target.value)}
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-last">Фамилия</FieldLabel>
                  <FieldContent>
                    <Input
                      id="pf-last"
                      required
                      minLength={1}
                      maxLength={120}
                      autoComplete="family-name"
                      value={p.lastName}
                      onChange={(e) => setField("lastName", e.target.value)}
                    />
                  </FieldContent>
                </Field>
                <Separator />
                <Field>
                  <FieldLabel htmlFor="pf-sex">Пол</FieldLabel>
                  <FieldContent>
                    <Select
                      value={p.sex ? p.sex : EMPTY}
                      onValueChange={(v) => setField("sex", v === EMPTY ? "" : v)}
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
                      onChange={(e) => setField("birthDate", e.target.value)}
                    />
                  </FieldContent>
                </Field>
                <Separator />
                <Field className="overflow-visible">
                  <FieldLabel htmlFor="pf-city">Город рождения</FieldLabel>
                  <FieldDescription>
                    Введите название; подсказки — города из списка приложения (с первого символа) и результаты поиска (от 3
                    символов).
                  </FieldDescription>
                  <FieldContent className="relative z-10 mt-2 overflow-visible" ref={cityWrapRef}>
                    <Input
                      ref={cityInputRef}
                      id="pf-city"
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={showCityDropdown}
                      value={p.birthCityCustom}
                      onChange={(e) => {
                        setField("birthCityCustom", e.target.value);
                        setCityListOpen(true);
                      }}
                      onFocus={() => setCityListOpen(true)}
                      placeholder="Начните вводить, например: Тула"
                      maxLength={200}
                    />
                    {showCityDropdown ? (
                      <ul
                        role="listbox"
                        className="bg-popover text-popover-foreground absolute top-full z-[200] mt-1.5 max-h-[min(70vh,22rem)] w-full min-w-0 overflow-y-auto overscroll-contain rounded-md border py-1 shadow-lg"
                      >
                        {citySuggestions.map((s) => (
                          <li key={s} role="option">
                            <button
                              type="button"
                              className="hover:bg-accent focus:bg-accent w-full whitespace-normal break-words px-3 py-2.5 text-left text-sm leading-snug outline-none"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setField("birthCityCustom", s);
                                setCityListOpen(false);
                                cityInputRef.current?.blur();
                              }}
                            >
                              {s}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-0 space-y-0">
          <Card>
            <CardHeader>
              <CardTitle>Учётная запись</CardTitle>
              <CardDescription>Логин и почту изменить нельзя. Телефон и пароль — можно.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <FieldGroup className="gap-6">
                <Field>
                  <FieldLabel htmlFor="pf-email">Электронная почта</FieldLabel>
                  <FieldDescription>Нельзя изменить.</FieldDescription>
                  <FieldContent>
                    <Input
                      id="pf-email"
                      type="email"
                      readOnly
                      tabIndex={-1}
                      className="bg-muted/60 text-muted-foreground"
                      value={p.email}
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-login">Логин</FieldLabel>
                  <FieldDescription>Нельзя изменить.</FieldDescription>
                  <FieldContent>
                    <Input
                      id="pf-login"
                      readOnly
                      tabIndex={-1}
                      className="bg-muted/60 text-muted-foreground"
                      value={p.login}
                    />
                  </FieldContent>
                </Field>
                <Separator />
                <Field>
                  <FieldLabel htmlFor="pf-phone">Телефон</FieldLabel>
                  <FieldContent>
                    <Input
                      id="pf-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      pattern={PHONE_ALLOWED_PATTERN}
                      title={PHONE_TITLE}
                      maxLength={32}
                      value={p.phone}
                      onChange={(e) => setField("phone", sanitizePhoneInput(e.target.value))}
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Смена пароля</h3>
                  <p className="text-muted-foreground mt-1 text-sm">Минимум 8 символов для нового пароля.</p>
                </div>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="pf-cur-pwd">Текущий пароль</FieldLabel>
                    <FieldContent>
                      <Input
                        id="pf-cur-pwd"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pf-new-pwd">Новый пароль</FieldLabel>
                    <FieldContent>
                      <Input
                        id="pf-new-pwd"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pf-confirm-pwd">Подтверждение</FieldLabel>
                    <FieldContent>
                      <Input
                        id="pf-confirm-pwd"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                </FieldGroup>
                <div className="flex justify-end">
                  <Button type="button" onClick={savePassword} disabled={savingPwd}>
                    {savingPwd ? "Сохранение…" : "Сменить пароль"}
                  </Button>
                </div>
              </div>
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
