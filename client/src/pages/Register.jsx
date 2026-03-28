import React, { useState } from "react";
import { apiPost, saveToken } from "../api.js";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { showApiError } from "@/lib/apiErrorSink.js";
import {
  PHONE_ALLOWED_PATTERN,
  PHONE_TITLE,
  sanitizePhoneInput,
  validateEmailOptional,
  validatePhoneClient,
} from "@/lib/validationFields.js";

export default function Register({ onAuth }) {
  const nav = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    login: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    const loginTrim = form.login.trim();
    if (!loginTrim) {
      showApiError("Укажите логин.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(loginTrim)) {
      showApiError("Логин: 3–32 символа, только латиница, цифры и символы _ . -");
      return;
    }
    if (form.password.length < 8) {
      showApiError("Пароль: не менее 8 символов.");
      return;
    }
    const pe = validatePhoneClient(form.phone);
    if (pe) {
      showApiError(pe);
      return;
    }
    const em = validateEmailOptional(form.email);
    if (em) {
      showApiError(em);
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost("/api/auth/register", form);
      if (data.token) saveToken(data.token);
      await onAuth?.();
      nav("/app/home");
    } catch {
      /* сообщение в глобальном диалоге из api.js */
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="size-10 rounded-md border" />
            <div>
              <CardTitle className="text-xl">Регистрация</CardTitle>
              <CardDescription>Аккаунт для генеалогического портала</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Имя</Label>
                <Input
                  id="firstName"
                  maxLength={120}
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input
                  id="lastName"
                  maxLength={120}
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Электронная почта</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  pattern={PHONE_ALLOWED_PATTERN}
                  title={PHONE_TITLE}
                  maxLength={32}
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", sanitizePhoneInput(e.target.value))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reg-login">Логин</Label>
                <Input
                  id="reg-login"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9._-]+"
                  title="Латиница, цифры, _ . - (3–32 символа)"
                  value={form.login}
                  onChange={(e) => set("login", e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Пароль</Label>
                <Input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Создание…" : "Зарегистрироваться"}
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => alert("Регистрация через Госуслуги недоступна в данной версии")}
              >
                Госуслуги
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => alert("Регистрация через MAX недоступна в данной версии")}
              >
                MAX ID
              </Button>
            </div>

            <p className="text-muted-foreground text-center text-sm">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
                Войти
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
