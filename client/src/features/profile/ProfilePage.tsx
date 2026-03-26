import { useEffect, useState } from "react";
import { apiGet, apiPut } from "@/shared/api";
import type { UserClient } from "@/types/api";
import { CITY_OPTIONS } from "@/data/cities";

export default function ProfilePage({ onProfileUpdated }: { onProfileUpdated?: () => void | Promise<void> }) {
  const [p, setP] = useState<UserClient | null>(null);
  const [birthMode, setBirthMode] = useState<"list" | "custom">("list");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const data = await apiGet<UserClient>("/api/profile");
      setP(data);
      setBirthMode(data.birthCityCustom ? "custom" : "list");
    })();
  }, []);

  function set<K extends keyof UserClient>(k: K, v: UserClient[K]) {
    setP((x) => (x ? { ...x, [k]: v } : x));
  }

  async function save() {
    if (!p) return;
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const payload = { ...p };
      if (birthMode === "list") payload.birthCityCustom = "";
      else payload.birthCity = "";
      await apiPut("/api/profile", payload);
      setOk("Данные профиля успешно сохранены");
      await onProfileUpdated?.();
      setTimeout(() => setOk(""), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!p) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div className="small">Загрузка профиля...</div>
      </div>
    );
  }

  const initials = ((p.firstName || "?")[0] + (p.lastName || "")[0]).toUpperCase();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, animation: "fadeIn 0.4s ease-out" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#3b82f6,#6366f1)",
            border: "3px solid rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div>
          <div className="page-title" style={{ animation: "none" }}>
            {p.firstName} {p.lastName}
          </div>
          <div className="page-desc" style={{ marginTop: 4 }}>
            Ваш профиль — центральный узел генеалогического древа
          </div>
        </div>
      </div>

      {err ? <div className="auth-err" style={{ marginBottom: 16 }}>Ошибка: {err}</div> : null}
      {ok ? (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "var(--radius-sm)",
            background: "var(--ok-soft)",
            border: "1px solid rgba(16,185,129,0.15)",
            color: "var(--ok)",
            fontSize: 13,
            marginBottom: 16,
            animation: "fadeIn 0.3s",
          }}
        >
          {ok}
        </div>
      ) : null}

      <div className="card">
        <div className="row">
          <div className="col">
            <div className="section-title" style={{ marginBottom: 12 }}>
              Личные данные
            </div>
            <div className="label">Имя</div>
            <input className="input" value={p.firstName} onChange={(e) => set("firstName", e.target.value)} />
            <div className="label">Фамилия</div>
            <input className="input" value={p.lastName} onChange={(e) => set("lastName", e.target.value)} />
            <div className="label">Электронная почта</div>
            <input className="input" value={p.email} onChange={(e) => set("email", e.target.value)} />
            <div className="label">Телефон</div>
            <input className="input" value={p.phone} onChange={(e) => set("phone", e.target.value)} />
            <div className="label">Логин</div>
            <input className="input" value={p.login} onChange={(e) => set("login", e.target.value)} />
          </div>

          <div className="col">
            <div className="section-title" style={{ marginBottom: 12 }}>
              Дополнительно
            </div>
            <div className="label">Пол</div>
            <select className="select" value={p.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="">Не указан</option>
              <option value="M">Мужской</option>
              <option value="F">Женский</option>
            </select>

            <div className="label">Дата рождения</div>
            <input type="date" className="input" value={p.birthDate} onChange={(e) => set("birthDate", e.target.value)} />

            <div className="label">Место рождения</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                className={`btn sm ${birthMode === "list" ? "primary" : "ghost"}`}
                onClick={() => setBirthMode("list")}
              >
                Из списка
              </button>
              <button
                type="button"
                className={`btn sm ${birthMode === "custom" ? "primary" : "ghost"}`}
                onClick={() => setBirthMode("custom")}
              >
                Вручную
              </button>
            </div>

            {birthMode === "list" ? (
              <select className="select" value={p.birthCity} onChange={(e) => set("birthCity", e.target.value)}>
                <option value="">Не выбрано</option>
                {CITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                value={p.birthCityCustom}
                onChange={(e) => set("birthCityCustom", e.target.value)}
                placeholder="Например: Тула"
              />
            )}

            <button type="button" className="btn primary lg block" onClick={() => void save()} disabled={saving} style={{ marginTop: 20 }}>
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
