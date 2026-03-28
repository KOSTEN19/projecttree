import { useState } from "react";
import { apiPost, saveToken } from "@/shared/api";
import type { AuthOkResponse } from "@/types/api";
import { Link, useNavigate } from "react-router-dom";

export default function LoginPage({ onAuth }: { onAuth?: () => void | Promise<void> }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ login: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function doLogin(credentials: { login: string; password: string }, redirectTo = "/app/home") {
    setErr("");
    setLoading(true);
    try {
      const data = await apiPost<AuthOkResponse>("/api/auth/login", credentials);
      if (data.token) saveToken(data.token);
      await onAuth?.();
      nav(redirectTo);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(form, "/app/home");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img
            className="auth-logo app-brand-logo"
            src="/logo.png"
            alt="Память России"
            width={44}
            height={44}
            decoding="async"
          />
          <div className="auth-brand-text">Память России</div>
        </div>

        <div className="auth-title">Вход в систему</div>
        <div className="auth-desc">Введите логин и пароль для доступа к личному кабинету</div>

        <div className="auth-demo">
          <strong>Демо-аккаунт:</strong> логин <code>demo</code>, пароль <code>demo123</code>
          <br />
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            Готовое древо с 18 родственниками для ознакомления
          </span>
        </div>

        {err ? <div className="auth-err">Ошибка: {err}</div> : null}

        <form onSubmit={(e) => void submit(e)}>
          <div className="auth-quick-wrap">
            <div className="auth-quick-title">Быстрый вход в УЗ</div>
            <div className="auth-quick-grid">
              <button
                className="btn primary auth-quick-btn"
                type="button"
                disabled={loading}
                onClick={() => void doLogin({ login: "demo", password: "demo123" }, "/app/home")}
              >
                Войти в УЗ demo
              </button>
              <button
                className="btn auth-quick-btn"
                type="button"
                disabled={loading}
                onClick={() => void doLogin({ login: "demo", password: "demo123" }, "/app/tree")}
              >
                В УЗ demo и сразу в Древо
              </button>
              <button
                className="btn auth-quick-btn"
                type="button"
                disabled={loading}
                onClick={() => void doLogin({ login: "demo", password: "demo123" }, "/app/map")}
              >
                В УЗ demo и сразу на Карту
              </button>
            </div>
          </div>

          <div className="auth-divider">или войдите вручную</div>

          <div className="label">Логин</div>
          <input
            className="input"
            value={form.login}
            onChange={(e) => set("login", e.target.value)}
            placeholder="Введите логин"
            autoComplete="username"
          />

          <div className="label">Пароль</div>
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="Введите пароль"
            autoComplete="current-password"
          />

          <button className="btn primary block lg" type="submit" disabled={loading} style={{ marginTop: 20 }}>
            {loading ? "Вход..." : "Войти"}
          </button>

          <div className="auth-divider">или</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn gos block"
              type="button"
              onClick={() => alert("Вход через Госуслуги недоступен в данной версии")}
            >
              Войти через Госуслуги (ЕСИА)
            </button>
            <button
              className="btn max block"
              type="button"
              onClick={() => alert("Вход через MAX недоступен в данной версии")}
            >
              Войти через MAX ID
            </button>
          </div>

          <div className="auth-footer">
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
