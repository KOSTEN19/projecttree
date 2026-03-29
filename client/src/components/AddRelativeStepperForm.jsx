import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost } from "../api.js";
import { CITY_OPTIONS } from "../data/cities.js";
import { fmtName } from "../features/tree/buildGraph";
import { inferLineForRelation } from "../features/tree/treeAddRelativePresets.js";
import { RELATION_TYPES } from "../lib/relationTypes.js";
import Stepper, { Step } from "../vendor/react-bits/Stepper/Stepper.jsx";
import "../vendor/react-bits/Stepper/Stepper.css";
import "./StepperRelatives.css";

function filterLocalCities(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return CITY_OPTIONS.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
}

function mergeCitySuggestions(localArr, remoteArr, max = 12) {
  const seen = new Set();
  const out = [];
  for (const s of [...localArr, ...remoteArr]) {
    const t = String(s || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function createDefaultForm({ self, initialBasePersonId, initialRelationType, initialLine }) {
  const base = initialBasePersonId ?? self?.id ?? "";
  const rel =
    initialRelationType !== undefined && initialRelationType !== null ? initialRelationType : "мать";
  const line = initialLine ?? "";
  return {
    basePersonId: base,
    relationType: rel,
    line,
    lastName: "",
    maidenName: "",
    firstName: "",
    middleName: "",
    sex: "",
    birthDate: "",
    birthCity: "",
    birthCityCustom: "",
    alive: true,
    deathDate: "",
    burialPlace: "",
    notes: "",
    biography: "",
    education: "",
    workPath: "",
    militaryPath: "",
  };
}

function normalizeHumanName(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s-])[a-zA-Zа-яА-ЯёЁ]/g, (m) => m.toUpperCase());
}

function trimText(v) {
  return String(v || "").trim().replace(/\s+/g, " ");
}

/** Ошибка шага 1–5 или null (совпадает с правилами финальной отправки). */
function getStepValidationError(step, form, treeAnchorMode) {
  const needsLine = !["дочь", "сын", "брат", "сестра"].includes(form.relationType);
  const t = (v) => String(v || "").trim();
  switch (step) {
    case 1:
      if (!form.basePersonId) return "Выберите базового человека.";
      if (!form.relationType) return "Выберите тип родственной связи.";
      if (!treeAnchorMode && needsLine && !form.line) return "Укажите линию родства.";
      return null;
    case 2:
      if (!t(form.lastName)) return "Укажите фамилию.";
      if (!t(form.firstName)) return "Укажите имя.";
      if (!t(form.middleName)) return "Укажите отчество.";
      if (!form.sex) return "Пол обязателен.";
      if (form.sex === "F" && !t(form.maidenName)) return "Укажите девичью фамилию.";
      return null;
    case 3:
      if (!form.birthDate) return "Дата рождения обязательна.";
      if (!t(form.birthCityCustom)) return "Укажите место рождения.";
      return null;
    case 4:
      if (!form.alive) {
        if (!form.deathDate) return "Укажите дату смерти.";
        if (!t(form.burialPlace)) return "Укажите место захоронения.";
      }
      return null;
    case 5:
      if (!t(form.education)) return "Укажите образование.";
      if (!t(form.workPath)) return "Укажите трудовой путь.";
      if (!t(form.militaryPath))
        return "Укажите боевой путь / службу (или кратко «не служил», если не применимо).";
      return null;
    default:
      return null;
  }
}

/** Список в document.body: степпер и модалка режут overflow у предков */
function FixedCitySuggestPortal({ open, anchorRef, suggestions, onPick }) {
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) {
      setBox(null);
      return;
    }
    function sync() {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      setBox({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
    }
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open, anchorRef, suggestions.length]);

  if (!open || !box || suggestions.length === 0) return null;

  return createPortal(
    <ul
      role="listbox"
      className="rel-suggest-menu rel-suggest-menu--popover rel-suggest-portal"
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        width: box.width,
        zIndex: 300,
      }}
    >
      {suggestions.map((s) => (
        <li key={s} role="option">
          <button
            type="button"
            className="rel-suggest-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(s)}
          >
            {s}
          </button>
        </li>
      ))}
    </ul>,
    document.body
  );
}

export default function AddRelativeStepperForm({
  persons,
  self,
  onCreated,
  /** Явные начальные значения (страница «Дерево» задаёт и меняет key у компонента). */
  initialBasePersonId,
  initialRelationType,
  initialLine,
  /** С древа: база фиксирована, линия не спрашивается (подставляется автоматически). */
  treeAnchorMode = false,
}) {
  const hasTreePreset =
    initialBasePersonId !== undefined ||
    initialRelationType !== undefined ||
    initialLine !== undefined;

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [birthCityListOpen, setBirthCityListOpen] = useState(false);
  const [burialCityListOpen, setBurialCityListOpen] = useState(false);
  const [birthRemoteSuggestions, setBirthRemoteSuggestions] = useState([]);
  const [burialRemoteSuggestions, setBurialRemoteSuggestions] = useState([]);
  const birthCityWrapRef = useRef(null);
  const burialCityWrapRef = useRef(null);
  const birthCityInputRef = useRef(null);
  const burialCityInputRef = useRef(null);

  const [form, setForm] = useState(() =>
    createDefaultForm({ self, initialBasePersonId, initialRelationType, initialLine }),
  );

  useEffect(() => {
    if (hasTreePreset) return;
    if (self?.id) setForm((p) => ({ ...p, basePersonId: self.id }));
  }, [self?.id, hasTreePreset]);

  useEffect(() => {
    const q = String(form.birthCityCustom || "").trim();
    if (q.length < 3) {
      setBirthRemoteSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const d = await apiGet(`/api/geo/suggest?q=${encodeURIComponent(q)}&limit=8`);
        if (!cancelled) setBirthRemoteSuggestions(Array.isArray(d?.items) ? d.items : []);
      } catch {
        if (!cancelled) setBirthRemoteSuggestions([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.birthCityCustom]);

  useEffect(() => {
    const q = String(form.burialPlace || "").trim();
    if (q.length < 3) {
      setBurialRemoteSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const d = await apiGet(`/api/geo/suggest?q=${encodeURIComponent(q)}&limit=8`);
        if (!cancelled) setBurialRemoteSuggestions(Array.isArray(d?.items) ? d.items : []);
      } catch {
        if (!cancelled) setBurialRemoteSuggestions([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.burialPlace]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (e.target.closest?.(".rel-suggest-portal")) return;
      if (!birthCityWrapRef.current?.contains(e.target)) setBirthCityListOpen(false);
      if (!burialCityWrapRef.current?.contains(e.target)) setBurialCityListOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const relativesForSelect = persons.filter((p) => !p.isPlaceholder);

  const basePersonReadonlyLabel = useMemo(() => {
    const p = relativesForSelect.find((x) => String(x.id) === String(form.basePersonId));
    if (!p) return form.basePersonId ? `ID ${form.basePersonId}` : "—";
    if (p.isSelf) return "Вы (профиль)";
    return fmtName(p);
  }, [relativesForSelect, form.basePersonId]);

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const childTypesNoLine = ["дочь", "сын", "брат", "сестра"].includes(form.relationType);
  const needsLine = !treeAnchorMode && !childTypesNoLine;

  const localBirthSuggestions = useMemo(
    () => filterLocalCities(form.birthCityCustom),
    [form.birthCityCustom]
  );
  const birthCitySuggestions = useMemo(
    () => mergeCitySuggestions(localBirthSuggestions, birthRemoteSuggestions),
    [localBirthSuggestions, birthRemoteSuggestions]
  );

  const localBurialSuggestions = useMemo(() => filterLocalCities(form.burialPlace), [form.burialPlace]);
  const burialCitySuggestions = useMemo(
    () => mergeCitySuggestions(localBurialSuggestions, burialRemoteSuggestions),
    [localBurialSuggestions, burialRemoteSuggestions]
  );

  const birthQTrim = String(form.birthCityCustom || "").trim();
  const showBirthCityDropdown =
    birthCityListOpen &&
    birthCitySuggestions.length > 0 &&
    birthCitySuggestions.some((s) => s !== birthQTrim);

  const burialQTrim = String(form.burialPlace || "").trim();
  const showBurialCityDropdown =
    burialCityListOpen &&
    burialCitySuggestions.length > 0 &&
    burialCitySuggestions.some((s) => s !== burialQTrim);

  const buildPayload = useCallback(() => {
    const payload = { ...form };
    let baseId = String(payload.basePersonId || "").trim();
    if (!baseId && self?.id) baseId = String(self.id);
    payload.basePersonId = baseId;
    payload.lastName = normalizeHumanName(payload.lastName);
    payload.firstName = normalizeHumanName(payload.firstName);
    payload.middleName = normalizeHumanName(payload.middleName);
    payload.maidenName = normalizeHumanName(payload.maidenName);
    payload.birthCity = "";
    payload.birthCityCustom = trimText(payload.birthCityCustom);
    payload.burialPlace = trimText(payload.burialPlace);
    payload.notes = trimText(payload.notes);
    payload.biography = trimText(payload.biography);
    payload.education = trimText(payload.education);
    payload.workPath = trimText(payload.workPath);
    payload.militaryPath = trimText(payload.militaryPath);

    delete payload.phone;

    if (treeAnchorMode) {
      payload.line = inferLineForRelation(payload.relationType);
    } else if (childTypesNoLine) {
      payload.line = "";
    }
    if (payload.alive) {
      payload.deathDate = "";
      payload.burialPlace = "";
    }
    return payload;
  }, [form, childTypesNoLine, treeAnchorMode, self?.id]);

  const onBeforeStepChange = useCallback(async (from, to) => {
    if (to <= from) return;
    for (let s = from; s < to; s++) {
      const err = getStepValidationError(s, form, treeAnchorMode);
      if (err) {
        setSubmitErr(err);
        throw new Error("validation");
      }
    }
    setSubmitErr("");
  }, [form, treeAnchorMode]);

  const onBeforeComplete = useCallback(async () => {
    setSubmitErr("");
    for (let s = 1; s <= 5; s++) {
      const err = getStepValidationError(s, form, treeAnchorMode);
      if (err) {
        setSubmitErr(err);
        throw new Error("validation");
      }
    }
    setSubmitting(true);
    try {
      const p = buildPayload();
      await apiPost("/api/persons", p);
      onCreated?.();
    } catch (e) {
      setSubmitErr(e?.message || String(e));
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, [buildPayload, form, onCreated, treeAnchorMode]);

  return (
    <div className="rel-stepper-host">
      {submitErr ? (
        <div className="rel-stepper-err" style={{ marginBottom: 12, fontSize: "0.85rem", color: "var(--destructive)" }}>
          {submitErr}
        </div>
      ) : null}

      <Stepper
        initialStep={1}
        backButtonText="Назад"
        nextButtonText="Далее"
        finalButtonText={submitting ? "Отправка…" : "Добавить в семью"}
        onBeforeStepChange={onBeforeStepChange}
        onBeforeComplete={onBeforeComplete}
        nextButtonProps={{ disabled: submitting, type: "button" }}
        backButtonProps={{ type: "button", disabled: submitting }}
        stepCircleContainerClassName="rel-stepper-card"
        contentClassName="rel-stepper-content"
        contentWrapperStyle={{ overflow: "visible" }}
      >
        <Step>
          <h3 className="rel-step-title">Связь в древе</h3>
          <p className="rel-step-hint">
            {treeAnchorMode
              ? "Базовый человек выбран на древе. Укажите, кем новая карточка приходится ему или ей."
              : "Для кого добавляется человек и как он связан с базовой карточкой."}
          </p>
          <div className="label">Базовый человек</div>
          {treeAnchorMode ? (
            <div className="rel-stepper-base-readonly" title="Чтобы сменить базу, закройте окно и выберите другого человека на древе">
              {basePersonReadonlyLabel}
            </div>
          ) : (
            <select className="select" value={form.basePersonId} onChange={(e) => set("basePersonId", e.target.value)}>
              {relativesForSelect.map((p) => {
                const label = p.isSelf ? "Я (профиль)" : [p.lastName, p.firstName].filter(Boolean).join(" ").trim();
                return (
                  <option key={p.id} value={p.id}>
                    {label || `Person ${p.id}`}
                  </option>
                );
              })}
            </select>
          )}
          <div className="label">Тип родственной связи</div>
          <select className="select" value={form.relationType} onChange={(e) => set("relationType", e.target.value)}>
            <option value="">— Выберите тип связи —</option>
            {RELATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {!treeAnchorMode ? (
            <>
              <div className="label">Линия родства</div>
              {!needsLine ? (
                <div className="small">Для «дочь», «сын», «брат», «сестра» линия не указывается.</div>
              ) : (
                <select className="select" required={needsLine} value={form.line} onChange={(e) => set("line", e.target.value)}>
                  <option value="">Не указано</option>
                  <option value="male">Мужская линия</option>
                  <option value="female">Женская линия</option>
                </select>
              )}
            </>
          ) : null}
        </Step>

        <Step>
          <h3 className="rel-step-title">Личные данные</h3>
          <p className="rel-step-hint">ФИО, пол и при необходимости девичья фамилия — обязательны для создания карточки.</p>
          <div className="label">Фамилия, имя, отчество</div>
          <div className="row">
            <div className="col">
              <input className="input" placeholder="Фамилия" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
            <div className="col">
              <input className="input" placeholder="Имя" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div className="col">
              <input className="input" placeholder="Отчество" required value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="col">
              <div className="label">Пол</div>
              <select className="select" required value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="">Не указан</option>
                <option value="M">Мужской</option>
                <option value="F">Женский</option>
              </select>
            </div>
          </div>
          {form.sex === "F" ? (
            <>
              <div className="label">Девичья фамилия</div>
              <input
                className="input"
                required
                placeholder="Например: Иванова"
                value={form.maidenName}
                onChange={(e) => set("maidenName", e.target.value)}
              />
            </>
          ) : null}
        </Step>

        <Step>
          <h3 className="rel-step-title">Рождение</h3>
          <p className="rel-step-hint">Дата и место рождения — опора для века на странице «Семья» и для карты.</p>
          <div className="label">Дата рождения</div>
          <input type="date" className="input" required value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          <div className="label">Город / место рождения</div>
          <p className="rel-step-hint" style={{ marginTop: "-0.35rem", marginBottom: "0.5rem" }}>
            Подсказки — города из списка приложения (с первого символа) и поиск по справочнику (от 3 символов), как в личном кабинете.
          </p>
          <div className="rel-suggest-wrap" ref={birthCityWrapRef}>
            <input
              ref={birthCityInputRef}
              className="input"
              required
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={showBirthCityDropdown}
              maxLength={200}
              value={form.birthCityCustom}
              onChange={(e) => {
                set("birthCityCustom", e.target.value);
                setBirthCityListOpen(true);
              }}
              onFocus={() => setBirthCityListOpen(true)}
              placeholder="Начните вводить, например: Тула"
            />
            <FixedCitySuggestPortal
              open={showBirthCityDropdown}
              anchorRef={birthCityWrapRef}
              suggestions={birthCitySuggestions}
              onPick={(s) => {
                set("birthCityCustom", s);
                setBirthCityListOpen(false);
                birthCityInputRef.current?.blur();
              }}
            />
          </div>
        </Step>

        <Step>
          <h3 className="rel-step-title">Жизнь и память</h3>
          <p className="rel-step-hint">Если человек умер, укажите дату и место захоронения — они попадут на карту.</p>
          <div className="label">Статус</div>
          <label className="badge" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={form.alive} onChange={(e) => set("alive", e.target.checked)} /> Жив(а)
          </label>
          {!form.alive ? (
            <>
              <div className="label">Дата смерти</div>
              <input type="date" className="input" required={!form.alive} value={form.deathDate} onChange={(e) => set("deathDate", e.target.value)} />
              <div className="label">Место захоронения</div>
              <p className="rel-step-hint" style={{ marginTop: "-0.35rem", marginBottom: "0.5rem" }}>
                Те же подсказки: локальный список городов и поиск (от 3 символов).
              </p>
              <div className="rel-suggest-wrap" ref={burialCityWrapRef}>
                <input
                  ref={burialCityInputRef}
                  className="input"
                  required={!form.alive}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={showBurialCityDropdown}
                  maxLength={200}
                  value={form.burialPlace}
                  onChange={(e) => {
                    set("burialPlace", e.target.value);
                    setBurialCityListOpen(true);
                  }}
                  onFocus={() => setBurialCityListOpen(true)}
                  placeholder="Начните вводить населённый пункт или адрес"
                />
                <FixedCitySuggestPortal
                  open={showBurialCityDropdown}
                  anchorRef={burialCityWrapRef}
                  suggestions={burialCitySuggestions}
                  onPick={(s) => {
                    set("burialPlace", s);
                    setBurialCityListOpen(false);
                    burialCityInputRef.current?.blur();
                  }}
                />
              </div>
            </>
          ) : (
            <div className="small" style={{ marginTop: 8 }}>
              Снимите галочку «Жив(а)», если нужно внести данные о смерти и захоронении.
            </div>
          )}
        </Step>

        <Step>
          <h3 className="rel-step-title">Биография и заметки</h3>
          <p className="rel-step-hint">
            Обязательны образование, трудовой путь и блок про службу. Биография и заметки можно оставить пустыми или дополнить позже.
          </p>
          <div className="label">Биография</div>
          <textarea className="textarea" rows={3} value={form.biography} onChange={(e) => set("biography", e.target.value)} />
          <div className="label">Образование</div>
          <textarea className="textarea" required rows={2} value={form.education} onChange={(e) => set("education", e.target.value)} />
          <div className="label">Трудовой путь</div>
          <textarea className="textarea" required rows={2} value={form.workPath} onChange={(e) => set("workPath", e.target.value)} />
          <div className="label">Боевой путь / служба</div>
          <textarea className="textarea" required rows={2} value={form.militaryPath} onChange={(e) => set("militaryPath", e.target.value)} />
          <div className="label">Заметки</div>
          <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Step>
      </Stepper>
    </div>
  );
}
