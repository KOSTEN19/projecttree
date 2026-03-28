import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPut, apiUploadPersonPhoto } from "../api.js";
import AuthedImg from "../components/AuthedImg.jsx";
import AddRelativeStepperForm from "../components/AddRelativeStepperForm.jsx";
import Modal from "../components/Modal.jsx";
import FamilyProfileCard from "../components/FamilyProfileCard.jsx";
import AddRelativePixelCard from "../components/AddRelativePixelCard.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import FamilyRelationStats from "@/components/FamilyRelationStats";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

function yearOf(person) {
  const y = parseInt((person?.birthDate || "").slice(0, 4), 10);
  return Number.isFinite(y) && y > 1000 && y < 2100 ? y : null;
}

function trimText(v) {
  return String(v || "").trim().replace(/\s+/g, " ");
}

function normalizeHumanName(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s-])[a-zA-Zа-яА-ЯёЁ]/g, (m) => m.toUpperCase());
}

function useAddressSuggestions(query) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = String(query || "").trim();
    if (q.length < 3) {
      setItems([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const data = await apiGet(`/api/geo/suggest?q=${encodeURIComponent(q)}&limit=8`);
        const next = Array.isArray(data?.items) ? data.items.filter(Boolean) : [];
        setItems(next);
      } catch {
        setItems([]);
      }
    }, 260);
    return () => clearTimeout(id);
  }, [query]);
  return items;
}

function centuryOf(year) {
  return Math.ceil(year / 100);
}

function centuryLabel(c) {
  const from = (c - 1) * 100 + 1;
  const to = c * 100;
  return `${ROMAN[c] || c} век (${from}-${to})`;
}

export default function Relatives() {
  const [persons, setPersons] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    const [personsData, relationshipsData] = await Promise.all([
      apiGet("/api/persons"),
      apiGet("/api/relationships").catch(() => []),
    ]);
    setPersons(personsData || []);
    setRelationships(Array.isArray(relationshipsData) ? relationshipsData : []);
  }

  useEffect(() => { load(); }, []);

  const self = useMemo(() => persons.find((p) => p.isSelf), [persons]);
  const relatives = useMemo(() => persons.filter((p) => !p.isSelf && !p.isPlaceholder), [persons]);
  const relationStats = useMemo(() => {
    const stats = {
      father: 0,
      mother: 0,
      child: 0,
      spouse: 0,
      sibling: 0,
      uncleAunt: 0,
      grand: 0,
      lineMale: 0,
      lineFemale: 0,
      total: relationships.length,
    };

    for (const r of relationships) {
      const t = String(r?.relationType || "").toLowerCase();
      const line = String(r?.line || "").toLowerCase();

      if (t === "отец") stats.father += 1;
      if (t === "мать") stats.mother += 1;
      if (t === "сын" || t === "дочь") stats.child += 1;
      if (t === "муж" || t === "жена") stats.spouse += 1;
      if (t === "брат" || t === "сестра") stats.sibling += 1;
      if (t === "дядя" || t === "тётя") stats.uncleAunt += 1;
      if (t === "бабушка" || t === "дедушка" || t === "внук" || t === "внучка") stats.grand += 1;

      if (line === "male") stats.lineMale += 1;
      if (line === "female") stats.lineFemale += 1;
    }

    return stats;
  }, [relationships]);
  const byEras = useMemo(() => {
    const byCentury = new Map();
    const unknown = [];

    for (const p of relatives) {
      const y = yearOf(p);
      if (!y) {
        unknown.push(p);
        continue;
      }
      const c = centuryOf(y);
      if (!byCentury.has(c)) byCentury.set(c, []);
      byCentury.get(c).push(p);
    }

    const groups = [...byCentury.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([c, items]) => {
        const sortedItems = [...items].sort((a, b) => (yearOf(a) || 0) - (yearOf(b) || 0));
        const byDecade = new Map();
        for (const p of sortedItems) {
          const y = yearOf(p);
          if (!y) continue;
          const decade = Math.floor(y / 10) * 10;
          byDecade.set(decade, (byDecade.get(decade) || 0) + 1);
        }
        const decades = [...byDecade.entries()].sort((a, b) => a[0] - b[0]);
        return {
          key: `c-${c}`,
          title: centuryLabel(c),
          items: sortedItems,
          decades,
        };
      });

    if (unknown.length) {
      groups.push({
        key: "unknown",
        title: "Без указанной даты рождения",
        items: [...unknown].sort((a, b) => {
          const an = [a.lastName, a.firstName].filter(Boolean).join(" ");
          const bn = [b.lastName, b.firstName].filter(Boolean).join(" ");
          return an.localeCompare(bn, "ru");
        }),
        decades: [],
      });
    }

    return groups;
  }, [relatives]);

  function openCard(p) {
    setSelected(p);
    setOpenView(true);
  }

  return (
    <div className="row">
      <div className="col">
        <Card>
          <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Моя семья</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Профили родственников, карточки и связи — основа древа и карты.
              </p>
            </div>
            <Button onClick={() => setOpenAdd(true)}>Добавить родственника</Button>
          </div>

          <Separator />

          {relationships.length > 0 ? <FamilyRelationStats stats={relationStats} /> : null}

          <Separator />

          <div className="rel-era-wrap">
            {self && (
              <div className="rel-era-group">
                <div className="rel-era-head">
                  <div className="rel-era-title">Вы</div>
                  <div className="rel-era-count">профиль</div>
                </div>
                <div className="rel-era-grid">
                  <div className="rel-era-item">
                    <FamilyProfileCard person={self} onOpen={openCard} />
                  </div>
                </div>
              </div>
            )}

            {relatives.length === 0 ? (
              <div className="rel-era-group">
                <div className="rel-era-head">
                  <div className="rel-era-title">Родственники</div>
                </div>
                <p className="text-muted-foreground mb-3 text-sm">Пока никого не добавлено — начните с карточки ниже.</p>
                <div className="rel-era-grid">
                  <AddRelativePixelCard onAdd={() => setOpenAdd(true)} />
                </div>
              </div>
            ) : (
              byEras.map((g) => (
                <div key={g.key} className="rel-era-group">
                  <div className="rel-era-head">
                    <div className="rel-era-title">{g.title}</div>
                    <div className="rel-era-count">{g.items.length} чел.</div>
                  </div>

                  {g.decades.length > 0 && (
                    <div className="rel-era-decades">
                      {g.decades.map(([dec, cnt]) => (
                        <span key={dec} className="rel-era-decade">{dec}-е: {cnt}</span>
                      ))}
                    </div>
                  )}

                  <div className="rel-era-grid">
                    {g.items.map((p) => (
                      <div key={p.id} className="rel-era-item">
                        <FamilyProfileCard person={p} onOpen={openCard} />
                      </div>
                    ))}
                    <AddRelativePixelCard onAdd={() => setOpenAdd(true)} />
                  </div>
                </div>
              ))
            )}
          </div>
          </CardContent>
        </Card>
      </div>

      <Modal open={openAdd} title="Добавить родственника" onClose={() => setOpenAdd(false)}>
        <AddRelativeStepperForm
          persons={persons}
          self={self}
          onCreated={async () => { setOpenAdd(false); await load(); }}
        />
      </Modal>

      <Modal open={openView} title="Карточка родственника" onClose={() => setOpenView(false)}>
        <RelativeCard
          person={selected}
          onUpdated={async () => { setOpenView(false); await load(); }}
          onDeleted={async () => { setOpenView(false); await load(); }}
        />
      </Modal>
    </div>
  );
}

function RelativeCard({ person, onUpdated, onDeleted }) {
  const [p, setP] = useState(person);
  const [birthSuggestOpen, setBirthSuggestOpen] = useState(false);
  const [burialSuggestOpen, setBurialSuggestOpen] = useState(false);
  const birthAddressSuggestions = useAddressSuggestions(p?.birthCityCustom || "");
  const burialAddressSuggestions = useAddressSuggestions(p?.burialPlace || "");

  useEffect(() => {
    const ext = Array.isArray(person?.externalLinks) ? person.externalLinks : [];
    setP({
      ...person,
      externalLinks: ext.length ? ext : [{ title: "", url: "" }],
    });
    setBirthSuggestOpen(false);

    setBurialSuggestOpen(false);
  }, [person]);

  if (!p) return <div className="small">Не выбрано</div>;

  function set(k, v) { setP((x) => ({ ...x, [k]: v })); }

  async function save() {
    const payload = { ...p };
    payload.lastName = normalizeHumanName(payload.lastName);
    payload.firstName = normalizeHumanName(payload.firstName);
    payload.middleName = normalizeHumanName(payload.middleName);
    payload.maidenName = normalizeHumanName(payload.maidenName || "");
    payload.birthCity = "";
    payload.birthCityCustom = trimText(payload.birthCityCustom);
    payload.burialPlace = trimText(payload.burialPlace);
    payload.notes = trimText(payload.notes);
    payload.biography = trimText(payload.biography);
    payload.education = trimText(payload.education);
    payload.workPath = trimText(payload.workPath);
    payload.militaryPath = trimText(payload.militaryPath);
    delete payload.phone;

    if (payload.alive) {
      payload.deathDate = "";
      payload.burialPlace = "";
    }

    payload.externalLinks = (p.externalLinks || [])
      .filter((L) => (L?.url || "").trim().length > 0)
      .map((L) => ({ title: (L.title || "").trim(), url: L.url.trim() }));

    await apiPut(`/api/persons/${p.id}`, payload);
    onUpdated?.();
  }

  function setLink(i, key, val) {
    setP((x) => {
      const arr = [...(x.externalLinks || [])];
      arr[i] = { ...(arr[i] || {}), [key]: val };
      return { ...x, externalLinks: arr };
    });
  }

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const next = await apiUploadPersonPhoto(p.id, file);
      setP((prev) => ({ ...prev, ...next, externalLinks: prev.externalLinks }));
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function remove() {
    if (!confirm("Удалить родственника?")) return;
    await apiDelete(`/api/persons/${p.id}`);
    onDeleted?.();
  }

  const name = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ").trim();

  return (
    <div>
      <div className="badge">Карточка: {name || "Без имени"}</div>

      <div className="label" style={{ marginTop: 12 }}>Фото</div>
      <div className="row" style={{ alignItems: "center", gap: 12 }}>
        {p.photoUrl ? (
          <AuthedImg src={p.photoUrl} alt="" className="rel-photo-thumb" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: 8, background: "hsl(var(--muted))" }} />
        )}
        <label className="badge" style={{ cursor: "pointer" }}>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={onPickPhoto} />
          Загрузить или заменить
        </label>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div className="col">
          <div className="label">Фамилия</div>
          <input className="input" value={p.lastName} onChange={(e) => set("lastName", e.target.value)} />
          <div className="label">Имя</div>
          <input className="input" value={p.firstName} onChange={(e) => set("firstName", e.target.value)} />
          <div className="label">Отчество</div>
          <input className="input" value={p.middleName} onChange={(e) => set("middleName", e.target.value)} />

          {p.sex === "F" && (
            <>
              <div className="label">Девичья фамилия</div>
              <input className="input" value={p.maidenName || ""} onChange={(e) => set("maidenName", e.target.value)} placeholder="Например: Иванова" />
            </>
          )}

        </div>

        <div className="col">
          <div className="label">Пол</div>
          <select className="select" value={p.sex} onChange={(e) => set("sex", e.target.value)}>
            <option value="">Не указан</option>
            <option value="M">Мужской</option>
            <option value="F">Женский</option>
          </select>

          <div className="label">Дата рождения</div>
          <input type="date" className="input" value={p.birthDate} onChange={(e) => set("birthDate", e.target.value)} />

          <div className="label">Место рождения (ручной ввод с подсказками)</div>
          <div className="rel-suggest-wrap">
            <input
              className="input"
              value={p.birthCityCustom || ""}
              onChange={(e) => {
                set("birthCityCustom", e.target.value);
                setBirthSuggestOpen(true);
              }}
              onFocus={() => setBirthSuggestOpen(true)}
              onBlur={() => setTimeout(() => setBirthSuggestOpen(false), 120)}
              placeholder="Начните вводить адрес или населенный пункт"
            />
            {birthSuggestOpen && birthAddressSuggestions.length > 0 ? (
              <div className="rel-suggest-menu select">
                {birthAddressSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rel-suggest-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      set("birthCityCustom", s);
                      setBirthSuggestOpen(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="label">Жив/жива</div>
          <label className="badge" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={p.alive} onChange={(e) => set("alive", e.target.checked)} /> Жив/жива
          </label>

          {!p.alive ? (
            <>
              <div className="label">Дата смерти</div>
              <input type="date" className="input" value={p.deathDate} onChange={(e) => set("deathDate", e.target.value)} />

              <div className="label">Место захоронения (из списка или вручную)</div>
              <div className="rel-suggest-wrap">
                <input
                  className="input"
                  value={p.burialPlace || ""}
                  onChange={(e) => {
                    set("burialPlace", e.target.value);
                    setBurialSuggestOpen(true);
                  }}
                  onFocus={() => setBurialSuggestOpen(true)}
                  onBlur={() => setTimeout(() => setBurialSuggestOpen(false), 120)}
                  placeholder="Начните вводить адрес места захоронения"
                />
                {burialSuggestOpen && burialAddressSuggestions.length > 0 ? (
                  <div className="rel-suggest-menu select">
                    {burialAddressSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="rel-suggest-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          set("burialPlace", s);
                          setBurialSuggestOpen(false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <details className="rel-details" style={{ marginTop: 12 }} open>
        <summary className="label" style={{ cursor: "pointer" }}>Биография и внешние ссылки</summary>
        <div className="label">Биография</div>
        <textarea className="textarea" rows={4} value={p.biography || ""} onChange={(e) => set("biography", e.target.value)} />
        <div className="label">Образование</div>
        <textarea className="textarea" rows={2} value={p.education || ""} onChange={(e) => set("education", e.target.value)} />
        <div className="label">Трудовой путь</div>
        <textarea className="textarea" rows={2} value={p.workPath || ""} onChange={(e) => set("workPath", e.target.value)} />
        <div className="label">Боевой путь / служба</div>
        <textarea className="textarea" rows={2} value={p.militaryPath || ""} onChange={(e) => set("militaryPath", e.target.value)} />

        <div className="label">Ссылки (например, «Бессмертный полк»)</div>
        {(p.externalLinks || []).map((L, i) => (
          <div key={i} className="row" style={{ alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
            <div className="col">
              <div className="small">Подпись</div>
              <input className="input" value={L.title || ""} onChange={(e) => setLink(i, "title", e.target.value)} placeholder="Название" />
            </div>
            <div className="col" style={{ flex: 2 }}>
              <div className="small">URL</div>
              <input className="input" value={L.url || ""} onChange={(e) => setLink(i, "url", e.target.value)} placeholder="https://..." />
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setP((x) => ({
                ...x,
                externalLinks: (x.externalLinks || []).filter((_, j) => j !== i),
              }))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => setP((x) => ({
            ...x,
            externalLinks: [...(x.externalLinks || []), { title: "", url: "" }],
          }))}
        >
          Добавить ссылку
        </button>
      </details>

      <div className="label">Старые заметки</div>
      <textarea className="textarea" value={p.notes || ""} onChange={(e) => set("notes", e.target.value)} />

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>Сохранить</button>
        <button className="btn danger" onClick={remove}>Удалить</button>
      </div>
    </div>
  );
}
