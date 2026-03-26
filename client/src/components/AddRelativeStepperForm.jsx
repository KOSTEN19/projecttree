import React, { useCallback, useEffect, useState } from "react";
import { apiPost } from "../api.js";
import { CITY_OPTIONS } from "../data/cities.js";
import Stepper, { Step } from "../vendor/react-bits/Stepper/Stepper.jsx";
import "../vendor/react-bits/Stepper/Stepper.css";
import "./StepperRelatives.css";

const RELATION_TYPES = [
  "внук", "внучка", "сын", "дочь", "жена", "муж", "мать", "отец",
  "бабушка", "дедушка", "дядя", "тётя", "сестра", "брат",
];

export default function AddRelativeStepperForm({ persons, self, onCreated }) {
  const [birthCityMode, setBirthCityMode] = useState("list");
  const [burialMode, setBurialMode] = useState("list");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");

  const [form, setForm] = useState({
    basePersonId: self?.id || "",
    relationType: "мать",
    line: "",
    lastName: "",
    maidenName: "",
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
    biography: "",
    education: "",
    workPath: "",
    militaryPath: "",
  });

  useEffect(() => {
    if (self?.id) setForm((p) => ({ ...p, basePersonId: self.id }));
  }, [self?.id]);

  const relativesForSelect = persons.filter((p) => !p.isPlaceholder);

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const needsLine = !["дочь", "сын", "брат", "сестра"].includes(form.relationType);

  const buildPayload = useCallback(() => {
    const payload = { ...form };
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
    return payload;
  }, [form, needsLine, birthCityMode]);

  const onBeforeComplete = useCallback(async () => {
    setSubmitErr("");
    setSubmitting(true);
    try {
      await apiPost("/api/persons", buildPayload());
      onCreated?.();
    } catch (e) {
      setSubmitErr(e?.message || String(e));
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, [buildPayload, onCreated]);

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
        onBeforeComplete={onBeforeComplete}
        nextButtonProps={{ disabled: submitting, type: "button" }}
        backButtonProps={{ type: "button", disabled: submitting }}
        stepCircleContainerClassName="rel-stepper-card"
        contentClassName="rel-stepper-content"
      >
        <Step>
          <h3 className="rel-step-title">Связь в древе</h3>
          <p className="rel-step-hint">Для кого добавляется человек и как он связан с базовой карточкой.</p>
          <div className="label">Базовый человек</div>
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
          <div className="label">Тип родственной связи</div>
          <select className="select" value={form.relationType} onChange={(e) => set("relationType", e.target.value)}>
            {RELATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="label">Линия родства</div>
          {!needsLine ? (
            <div className="small">Для «дочь», «сын», «брат», «сестра» линия не указывается.</div>
          ) : (
            <select className="select" value={form.line} onChange={(e) => set("line", e.target.value)}>
              <option value="">Не указано</option>
              <option value="male">Мужская линия</option>
              <option value="female">Женская линия</option>
            </select>
          )}
        </Step>

        <Step>
          <h3 className="rel-step-title">Личные данные</h3>
          <p className="rel-step-hint">ФИО и пол можно уточнить позже; имя желательно с самого начала.</p>
          <div className="label">Фамилия, имя, отчество</div>
          <div className="row">
            <div className="col">
              <input className="input" placeholder="Фамилия" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
            <div className="col">
              <input className="input" placeholder="Имя" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div className="col">
              <input className="input" placeholder="Отчество" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
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
              <div className="label">Телефон</div>
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          {form.sex === "F" ? (
            <>
              <div className="label">Девичья фамилия</div>
              <input
                className="input"
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
          <input type="date" className="input" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          <div className="label">Место рождения</div>
          <div className="row" style={{ alignItems: "center" }}>
            <label className="badge" style={{ cursor: "pointer" }}>
              <input type="radio" checked={birthCityMode === "list"} onChange={() => setBirthCityMode("list")} /> Из списка
            </label>
            <label className="badge" style={{ cursor: "pointer" }}>
              <input type="radio" checked={birthCityMode === "custom"} onChange={() => setBirthCityMode("custom")} /> Вручную
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
              <input type="date" className="input" value={form.deathDate} onChange={(e) => set("deathDate", e.target.value)} />
              <div className="label">Место захоронения</div>
              <div className="row" style={{ alignItems: "center" }}>
                <label className="badge" style={{ cursor: "pointer" }}>
                  <input type="radio" checked={burialMode === "list"} onChange={() => setBurialMode("list")} /> Из списка
                </label>
                <label className="badge" style={{ cursor: "pointer" }}>
                  <input type="radio" checked={burialMode === "custom"} onChange={() => setBurialMode("custom")} /> Вручную
                </label>
              </div>
              {burialMode === "list" ? (
                <select className="select" value={form.burialPlace} onChange={(e) => set("burialPlace", e.target.value)}>
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
            <div className="small" style={{ marginTop: 8 }}>
              Снимите галочку «Жив(а)», если нужно внести данные о смерти и захоронении.
            </div>
          )}
        </Step>

        <Step>
          <h3 className="rel-step-title">Биография и заметки</h3>
          <p className="rel-step-hint">Всё необязательно: можно заполнить позже в карточке родственника.</p>
          <div className="label">Биография</div>
          <textarea className="textarea" rows={3} value={form.biography} onChange={(e) => set("biography", e.target.value)} />
          <div className="label">Образование</div>
          <textarea className="textarea" rows={2} value={form.education} onChange={(e) => set("education", e.target.value)} />
          <div className="label">Трудовой путь</div>
          <textarea className="textarea" rows={2} value={form.workPath} onChange={(e) => set("workPath", e.target.value)} />
          <div className="label">Боевой путь / служба</div>
          <textarea className="textarea" rows={2} value={form.militaryPath} onChange={(e) => set("militaryPath", e.target.value)} />
          <div className="label">Заметки</div>
          <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Step>
      </Stepper>
    </div>
  );
}
