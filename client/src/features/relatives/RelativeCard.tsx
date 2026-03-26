import { useEffect, useState } from "react";
import { apiDelete, apiPut } from "@/shared/api";
import type { PersonClient } from "@/types/api";
import { CITY_OPTIONS } from "@/data/cities";

export function RelativeCard({
  person,
  onUpdated,
  onDeleted,
}: {
  person: PersonClient | null;
  onUpdated?: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
}) {
  const [p, setP] = useState<PersonClient | null>(person);
  const [birthMode, setBirthMode] = useState<"list" | "custom">("list");
  const [birthListValue, setBirthListValue] = useState("");
  const [birthCustomValue, setBirthCustomValue] = useState("");
  const [burialMode, setBurialMode] = useState<"list" | "custom">("list");

  useEffect(() => {
    setP(person);
    if (!person) return;
    const bm = person.birthCityCustom ? "custom" : "list";
    setBirthMode(bm);
    setBirthListValue(person.birthCity || "");
    setBirthCustomValue(person.birthCityCustom || "");

    const burialText = person.burialPlace || "";
    const isFromList = (CITY_OPTIONS as readonly string[]).includes(burialText);
    setBurialMode(isFromList ? "list" : "custom");
  }, [person]);

  if (!p) return <div className="small">Не выбрано</div>;

  function setField<K extends keyof PersonClient>(k: K, v: PersonClient[K]) {
    setP((x) => (x ? { ...x, [k]: v } : x));
  }

  async function save() {
    const payload: PersonClient = { ...p };

    if (birthMode === "list") {
      payload.birthCity = birthListValue;
      payload.birthCityCustom = "";
    } else {
      payload.birthCity = "";
      payload.birthCityCustom = birthCustomValue;
    }

    if (payload.alive) {
      payload.deathDate = "";
      payload.burialPlace = "";
    }

    await apiPut(`/api/persons/${p.id}`, payload);
    await onUpdated?.();
  }

  async function remove() {
    if (!confirm("Удалить родственника?")) return;
    await apiDelete(`/api/persons/${p.id}`);
    await onDeleted?.();
  }

  const name = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ").trim();

  return (
    <div>
      <div className="badge">Карточка: {name || "Без имени"}</div>

      <div className="row" style={{ marginTop: 12 }}>
        <div className="col">
          <div className="label">Фамилия</div>
          <input className="input" value={p.lastName} onChange={(e) => setField("lastName", e.target.value)} />
          <div className="label">Имя</div>
          <input className="input" value={p.firstName} onChange={(e) => setField("firstName", e.target.value)} />
          <div className="label">Отчество</div>
          <input className="input" value={p.middleName} onChange={(e) => setField("middleName", e.target.value)} />

          <div className="label">Телефон</div>
          <input className="input" value={p.phone} onChange={(e) => setField("phone", e.target.value)} />
        </div>

        <div className="col">
          <div className="label">Пол</div>
          <select className="select" value={p.sex} onChange={(e) => setField("sex", e.target.value)}>
            <option value="">Не указан</option>
            <option value="M">Мужской</option>
            <option value="F">Женский</option>
          </select>

          <div className="label">Дата рождения</div>
          <input
            type="date"
            className="input"
            value={p.birthDate}
            onChange={(e) => setField("birthDate", e.target.value)}
          />

          <div className="label">Место рождения (из списка или вручную)</div>
          <div className="row" style={{ alignItems: "center" }}>
            <label className="badge" style={{ cursor: "pointer" }}>
              <input type="radio" checked={birthMode === "list"} onChange={() => setBirthMode("list")} /> Из списка
            </label>
            <label className="badge" style={{ cursor: "pointer" }}>
              <input type="radio" checked={birthMode === "custom"} onChange={() => setBirthMode("custom")} /> Ввести
              вручную
            </label>
          </div>

          {birthMode === "list" ? (
            <select className="select" value={birthListValue} onChange={(e) => setBirthListValue(e.target.value)}>
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
              value={birthCustomValue}
              onChange={(e) => setBirthCustomValue(e.target.value)}
              placeholder="Например: Тула"
            />
          )}

          <div className="label">Жив/жива</div>
          <label className="badge" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={p.alive} onChange={(e) => setField("alive", e.target.checked)} /> Жив/жива
          </label>

          {!p.alive ? (
            <>
              <div className="label">Дата смерти</div>
              <input
                type="date"
                className="input"
                value={p.deathDate}
                onChange={(e) => setField("deathDate", e.target.value)}
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
                  value={p.burialPlace || ""}
                  onChange={(e) => setField("burialPlace", e.target.value)}
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
                  value={p.burialPlace || ""}
                  onChange={(e) => setField("burialPlace", e.target.value)}
                  placeholder="Например: Тула"
                />
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="label">Заметки</div>
      <textarea className="textarea" value={p.notes} onChange={(e) => setField("notes", e.target.value)} />

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn primary" onClick={() => void save()}>
          Сохранить
        </button>
        <button type="button" className="btn danger" onClick={() => void remove()}>
          Удалить
        </button>
      </div>
    </div>
  );
}
