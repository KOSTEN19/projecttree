import { useState } from "react";
import { apiPost, saveToken } from "@/shared/api";
import type { AuthOkResponse } from "@/types/api";
import { Link, useNavigate } from "react-router-dom";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

type RegForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  login: string;
  password: string;
};

export default function RegisterPage({ onAuth }: { onAuth?: () => void | Promise<void> }) {
  const nav = useNavigate();
  const [form, setForm] = useState<RegForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    login: "",
    password: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof RegForm>(k: K, v: RegForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await apiPost<AuthOkResponse>("/api/auth/register", form);
      if (data.token) saveToken(data.token);
      await onAuth?.();
      nav("/app/home");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-brand">
          <img
            className="auth-logo app-brand-logo"
            src={BRAND_LOGO_SRC}
            alt="Память России"
            width={44}
            height={44}
            decoding="async"
          />
          <div className="auth-brand-text">Память России</div>
        </div>

        <div className="auth-title">Регистрация</div>
        <div className="auth-desc">Создайте аккаунт для работы с генеалогическим порталом</div>

        {err ? <div className="auth-err">Ошибка: {err}</div> : null}

        <form onSubmit={(e) => void submit(e)}>
          <div className="row">
            <div className="col">
              <div className="label">Имя</div>
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder="Алексей"
              />
            </div>
            <div className="col">
              <div className="label">Фамилия</div>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                placeholder="Иванов"
              />
            </div>
          </div>

          <div className="row">
            <div className="col">
              <div className="label">Электронная почта</div>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="col">
              <div className="label">Телефон</div>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+7 999 000-00-00"
              />
            </div>
          </div>

          <div className="row">
            <div className="col">
              <div className="label">Логин</div>
              <input
                className="input"
                value={form.login}
                onChange={(e) => set("login", e.target.value)}
                placeholder="Придумайте логин"
                autoComplete="username"
              />
            </div>
            <div className="col">
              <div className="label">Пароль</div>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Минимум 4 символа"
                autoComplete="new-password"
              />
            </div>
          </div>

          <button className="btn primary block lg" type="submit" disabled={loading} style={{ marginTop: 20 }}>
            {loading ? "Создание..." : "Зарегистрироваться"}
          </button>

          <div className="auth-divider">или</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn gos"
              type="button"
              style={{ flex: 1 }}
              onClick={() => alert("Регистрация через Госуслуги недоступна в данной версии")}
            >
              Через Госуслуги
            </button>
            <button
              className="btn max"
              type="button"
              style={{ flex: 1 }}
              onClick={() => alert("Регистрация через MAX недоступна в данной версии")}
            >
              Через MAX ID
            </button>
          </div>

          <div className="auth-footer">
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
