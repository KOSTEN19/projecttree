import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/shared/api";
import type { PersonClient, RelationshipClient } from "@/types/api";
import Modal from "@/shared/components/Modal";
import PersonCard from "@/shared/components/PersonCard";
import { AddRelativeForm } from "./AddRelativeForm";
import { RelativeCard } from "./RelativeCard";
import { centuryLabel, centuryOf, yearOf } from "./relativesUtils";
import FamilyRelationStats from "@/components/FamilyRelationStats";

export default function RelativesPage() {
  const [persons, setPersons] = useState<PersonClient[]>([]);
  const [relationships, setRelationships] = useState<RelationshipClient[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [selected, setSelected] = useState<PersonClient | null>(null);

  async function load() {
    const [personsData, relationshipsData] = await Promise.all([
      apiGet<PersonClient[]>("/api/persons"),
      apiGet<RelationshipClient[]>("/api/relationships").catch(() => [] as RelationshipClient[]),
    ]);
    setPersons(personsData || []);
    setRelationships(Array.isArray(relationshipsData) ? relationshipsData : []);
  }

  useEffect(() => {
    void load();
  }, []);

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
    const byCentury = new Map<number, PersonClient[]>();
    const unknown: PersonClient[] = [];

    for (const p of relatives) {
      const y = yearOf(p);
      if (!y) {
        unknown.push(p);
        continue;
      }
      const c = centuryOf(y);
      if (!byCentury.has(c)) byCentury.set(c, []);
      byCentury.get(c)!.push(p);
    }

    const groups = [...byCentury.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([c, items]) => {
        const sortedItems = [...items].sort((a, b) => (yearOf(a) || 0) - (yearOf(b) || 0));
        const byDecade = new Map<number, number>();
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
        decades: [] as [number, number][],
      });
    }

    return groups;
  }, [relatives]);

  function openCard(p: PersonClient) {
    setSelected(p);
    setOpenView(true);
  }

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="h1">Моя семья</div>
              <div className="h2">
                Создайте полноценный цифровой профиль для каждого члена Вашей семьи. Добавьте родственника и заполните его
                карточку: укажите ФИО, дату и место рождения, контактную информацию и историческую справку (при наличии).
                Эта структурированная база данных станет основой для автоматического построения древа, работы с картой и
                наполнения семейного архива.
              </div>
            </div>
            <button type="button" className="btn primary" onClick={() => setOpenAdd(true)}>
              Добавить родственника
            </button>
          </div>

          <div className="hr" />

          {relationships.length > 0 ? <FamilyRelationStats stats={relationStats} /> : null}

          <div className="hr" />

          {relatives.length === 0 ? (
            <div className="small">Пока нет добавленных родственников</div>
          ) : (
            <div className="rel-era-wrap">
              {byEras.map((g) => (
                <div key={g.key} className="rel-era-group">
                  <div className="rel-era-head">
                    <div className="rel-era-title">{g.title}</div>
                    <div className="rel-era-count">{g.items.length} чел.</div>
                  </div>

                  {g.decades.length > 0 ? (
                    <div className="rel-era-decades">
                      {g.decades.map(([dec, cnt]) => (
                        <span key={dec} className="rel-era-decade">
                          {dec}-е: {cnt}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="rel-era-grid">
                    {g.items.map((p) => (
                      <div key={p.id} className="rel-era-item" onClick={() => openCard(p)}>
                        <PersonCard p={p} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={openAdd} title="Добавить родственника" onClose={() => setOpenAdd(false)}>
        <AddRelativeForm
          persons={persons}
          self={self}
          onCreated={async () => {
            setOpenAdd(false);
            await load();
          }}
        />
      </Modal>

      <Modal open={openView} title="Карточка родственника" onClose={() => setOpenView(false)}>
        <RelativeCard
          person={selected}
          onUpdated={async () => {
            setOpenView(false);
            await load();
          }}
          onDeleted={async () => {
            setOpenView(false);
            await load();
          }}
        />
      </Modal>
    </div>
  );
}
