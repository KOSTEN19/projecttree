import { useEffect, useState } from "react";
import { apiPost } from "@/shared/api";
import type { PersonClient } from "@/types/api";
import { CITY_OPTIONS } from "@/data/cities";
import { RELATION_TYPES } from "./constants";

export type NewRelativeFormState = {
  basePersonId: string;
  relationType: string;
  line: string;
  lastName: string;
  firstName: string;
  middleName: string;
  sex: string;
  birthDate: string;
  birthCity: string;
  birthCityCustom: string;
  phone: string;
  alive: boolean;
  deathDate: string;
  burialPlace: string;
  notes: string;
};

const initialForm = (): NewRelativeFormState => ({
  basePersonId: "",
  relationType: "мать",
  line: "",
  lastName: "",
  firstName: "",
  middleName: "",
  sex: "",
  birthDate: "",
  birthCity: "",
  birthCityCustom: "",
  phone: "",
  alive: true,
  deathDate: "",
  burialPlace: "",
  notes: "",
});

export function AddRelativeForm({
  persons,
  self,
  onCreated,
}: {
  persons: PersonClient[];
  self: PersonClient | undefined;
  onCreated?: () => void | Promise<void>;
}) {
  const [birthCityMode, setBirthCityMode] = useState<"list" | "custom">("list");
  const [burialMode, setBurialMode] = useState<"list" | "custom">("list");
  const [form, setForm] = useState<NewRelativeFormState>(initialForm);

  useEffect(() => {
    if (self?.id) setForm((p) => ({ ...p, basePersonId: self.id }));
  }, [self?.id]);

  const relativesForSelect = persons.filter((p) => !p.isPlaceholder);

  function set<K extends keyof NewRelativeFormState>(k: K, v: NewRelativeFormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const needsLine = !["дочь", "сын", "брат", "сестра"].includes(form.relationType);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const payload: Record<string, unknown> = { ...form };
    if (!payload.basePersonId && self?.id) {
      payload.basePersonId = self.id;
    }
    if (!needsLine) payload.line = "";

    if (birthCityMode === "custom") {
      payload.birthCity = "";
    } else {
      payload.birthCityCustom = "";
    }

    if (payload.alive) {
      payload.deathDate = "";
      payload.burialPlace = "";
    }

    await apiPost("/api/persons", payload);
    await onCreated?.();
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <div className="row">
        <div className="col">
          <div className="label">1) Добавление для себя или для другого родственника</div>
          <select
            className="select"
            value={form.basePersonId}
            onChange={(e) => set("basePersonId", e.target.value)}
          >
            {relativesForSelect.map((p) => {
              const label = p.isSelf
                ? "Я (профиль)"
                : [p.lastName, p.firstName].filter(Boolean).join(" ").trim();
              return (
                <option key={p.id} value={p.id}>
                  {label || `Person ${p.id}`}
                </option>
              );
            })}
          </select>

          <div className="label">2) Родственная связь</div>
          <select
            className="select"
            value={form.relationType}
            onChange={(e) => set("relationType", e.target.value)}
          >
            {RELATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="label">3) Линия родства</div>
          {!needsLine ? (
            <div className="small">Для &quot;дочь&quot;, &quot;сын&quot;, &quot;брат&quot;, &quot;сестра&quot; линия не указывается</div>
          ) : (
            <select className="select" value={form.line} onChange={(e) => set("line", e.target.value)}>
              <option value="">Не указано</option>
              <option value="male">Мужская линия</option>
              <option value="female">Женская линия</option>
            </select>
          )}

          <div className="hr" />

          <div className="label">4) ФИО</div>
          <div className="row">
            <div className="col">
              <input
                className="input"
                placeholder="Фамилия"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
            <div className="col">
              <input
                className="input"
                placeholder="Имя"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div className="col">
              <input
                className="input"
                placeholder="Отчество"
                value={form.middleName}
                onChange={(e) => set("middleName", e.target.value)}
              />
            </div>
          </div>

          <div className="row">
            <div className="col">
              <div className="label">Пол</div>
              <select className="select" value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="">Не указан</option>
                <option value="M">Мужской</option>
                <option value="F">Женский</option>
              </select>
            </div>
            <div className="col">
              <div className="label">Дата рождения</div>
              <input
                type="date"
                className="input"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </div>
            <div className="col">
              <div className="label">Телефон</div>
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div className="label">Место рождения (из списка или вручную)</div>
          <div className="row" style={{ alignItems: "center" }}>
            <label className="badge" style={{ cursor: "pointer" }}>
              <input
                type="radio"
                checked={birthCityMode === "list"}
                onChange={() => setBirthCityMode("list")}
              />{" "}
              Из списка
            </label>
            <label className="badge" style={{ cursor: "pointer" }}>
              <input
                type="radio"
                checked={birthCityMode === "custom"}
                onChange={() => setBirthCityMode("custom")}
              />{" "}
              Ввести вручную
            </label>
          </div>

          {birthCityMode === "list" ? (
            <select className="select" value={form.birthCity} onChange={(e) => set("birthCity", e.target.value)}>
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
              value={form.birthCityCustom}
              onChange={(e) => set("birthCityCustom", e.target.value)}
              placeholder="Например: Тула"
            />
          )}
        </div>

        <div className="col">
          <div className="label">5) Жив/жива</div>
          <label className="badge" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={form.alive} onChange={(e) => set("alive", e.target.checked)} /> Жив/жива
          </label>

          {!form.alive ? (
            <>
              <div className="label">Дата смерти</div>
              <input
                type="date"
                className="input"
                value={form.deathDate}
                onChange={(e) => set("deathDate", e.target.value)}
              />

              <div className="label">Место захоронения (из списка или вручную)</div>
              <div className="row" style={{ alignItems: "center" }}>
                <label className="badge" style={{ cursor: "pointer" }}>
                  <input type="radio" checked={burialMode === "list"} onChange={() => setBurialMode("list")} /> Из списка
                </label>
                <label className="badge" style={{ cursor: "pointer" }}>
                  <input type="radio" checked={burialMode === "custom"} onChange={() => setBurialMode("custom")} /> Ввести
                  вручную
                </label>
              </div>

              {burialMode === "list" ? (
                <select
                  className="select"
                  value={form.burialPlace}
                  onChange={(e) => set("burialPlace", e.target.value)}
                >
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
                  value={form.burialPlace}
                  onChange={(e) => set("burialPlace", e.target.value)}
                  placeholder="Например: Тула"
                />
              )}
            </>
          ) : (
            <div className="small">Если снять галочку - появятся поля даты смерти и места захоронения</div>
          )}

          <div className="hr" />

          <div className="label">6) Заметки</div>
          <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} />

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" type="submit">
              Добавить
            </button>
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            Не все поля обязательны
          </div>
        </div>
      </div>
    </form>
  );
}
