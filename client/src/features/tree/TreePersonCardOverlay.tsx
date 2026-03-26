import type { TreeChipPerson } from "./TreeAvatars";
import { Av } from "./TreeAvatars";
import { fmtFullName } from "./buildGraph";

function Row({ l, v, hl }: { l: string; v: string; hl?: boolean }) {
  return (
    <div className={`tree-mc-row${hl ? " hl" : ""}`}>
      <div className="tree-mc-label">{l}</div>
      <div className="tree-mc-val">{v || "—"}</div>
    </div>
  );
}

export type TreeCardPerson = TreeChipPerson & {
  isVirtual?: boolean;
  middleName?: string;
  birthDate?: string;
  birthCity?: string;
  birthCityCustom?: string;
  phone?: string;
  alive?: boolean;
  deathDate?: string;
  burialPlace?: string;
  maidenName?: string;
  biography?: string;
  education?: string;
  workPath?: string;
  militaryPath?: string;
  externalLinks?: Array<{ title?: string; url: string }>;
  notes?: string;
};

export function TreePersonCardOverlay({
  card,
  onClose,
}: {
  card: TreeCardPerson;
  onClose: () => void;
}) {
  return (
    <div className="tree-mc-overlay" onClick={onClose} role="presentation">
      <div
        className="tree-mc-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tree-person-card-title-${String(card.id || "anon")}`}
      >
        <button type="button" className="tree-mc-x" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
        <div className="tree-mc-photo">
          <Av p={card} size={150} />
          <div className="tree-mc-name" id={`tree-person-card-title-${String(card.id || "anon")}`}>
            {fmtFullName(card)}
          </div>
          <div className="tree-mc-meta">
            {card.isSelf ? "Это Вы" : card.isVirtual ? "Placeholder" : "Родственник"}
            {card.birthDate ? ` · р. ${card.birthDate}` : ""}
          </div>
        </div>
        <div className="tree-mc-body">
          <Row
            l="Пол"
            v={card.sex === "M" ? "Мужской" : card.sex === "F" ? "Женский" : "Не указан"}
          />
          <Row l="Дата рождения" v={card.birthDate || ""} />
          <Row l="Место рождения" v={card.birthCityCustom || card.birthCity || ""} />
          <Row l="Телефон" v={card.phone || ""} />
          <Row l="Статус" v={card.alive ? "Жив(а)" : "Умер(ла)"} hl={!card.alive} />
          {!card.alive && (
            <>
              <Row l="Дата смерти" v={card.deathDate || ""} />
              <Row l="Место захоронения" v={card.burialPlace || ""} />
            </>
          )}
          {card.sex === "F" && card.maidenName ? (
            <Row l="Девичья фамилия" v={card.maidenName} />
          ) : null}
          {card.biography ? <Row l="Биография" v={card.biography} /> : null}
          {card.education ? <Row l="Образование" v={card.education} /> : null}
          {card.workPath ? <Row l="Трудовой путь" v={card.workPath} /> : null}
          {card.militaryPath ? <Row l="Боевой путь / служба" v={card.militaryPath} /> : null}
          {Array.isArray(card.externalLinks) && card.externalLinks.length > 0 ? (
            <div className="tree-mc-row">
              <div className="tree-mc-label">Ссылки</div>
              <div className="tree-mc-val tree-mc-links">
                {card.externalLinks.map((L, i) => (
                  <a key={i} href={L.url} target="_blank" rel="noreferrer">
                    {L.title || L.url}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {card.notes ? <Row l="Заметки (архив)" v={card.notes} /> : null}
        </div>
      </div>
    </div>
  );
}
