import React, { useState } from "react";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { apiPost, saveToken } from "../api.js";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Login({ onAuth }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ login: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function doLogin(credentials, redirectTo = "/app/home") {
    setErr("");
    setLoading(true);
    try {
      const data = await apiPost("/api/auth/login", credentials, { silentGlobalDialog: true });
      if (data.token) saveToken(data.token);
      await onAuth?.();
      nav(redirectTo);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    await doLogin(form, "/app/home");
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <img
              src={BRAND_LOGO_SRC}
              alt="Память России"
              width={40}
              height={40}
              className="app-brand-logo size-10 shrink-0 rounded-md border"
              decoding="async"
            />
            <div>
              <CardTitle className="text-xl">Память России</CardTitle>
              <CardDescription>Вход в личный кабинет</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTitle className="text-sm">Демо</AlertTitle>
            <AlertDescription className="text-xs">
              Логин <code className="bg-muted rounded px-1">demo</code>, пароль{" "}
              <code className="bg-muted rounded px-1">demo123</code> — 18 родственников в примере.
            </AlertDescription>
          </Alert>

          {err && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-muted-foreground text-xs font-medium">Быстрый вход</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  onClick={() => doLogin({ login: "demo", password: "demo123" }, "/app/home")}
                >
                  Demo → главная
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => doLogin({ login: "demo", password: "demo123" }, "/app/tree")}
                >
                  Demo → древо
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => doLogin({ login: "demo", password: "demo123" }, "/app/map")}
                >
                  Demo → карта
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card text-muted-foreground px-2">или вручную</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login">Логин</Label>
              <Input
                id="login"
                value={form.login}
                onChange={(e) => set("login", e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Вход…" : "Войти"}
            </Button>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => alert("Вход через Госуслуги недоступен в данной версии")}
              >
                Госуслуги (ЕСИА)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => alert("Вход через MAX недоступен в данной версии")}
              >
                MAX ID
              </Button>
            </div>

            <p className="text-muted-foreground text-center text-sm">
              Нет аккаунта?{" "}
              <Link to="/register" className="text-foreground font-medium underline underline-offset-4">
                Регистрация
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
