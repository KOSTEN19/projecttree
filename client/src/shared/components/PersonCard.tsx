import type { PersonClient } from "@/types/api";

export default function PersonCard({ p }: { p: PersonClient }) {
  const name = [p.lastName, p.firstName].filter(Boolean).join(" ").trim() || "Без имени";
  const birth = p.birthDate ? `р. ${p.birthDate}` : "дата рождения не указана";

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 800 }}>{name}</div>
      <div className="small" style={{ marginTop: 6 }}>
        {birth}
      </div>
    </div>
  );
}
