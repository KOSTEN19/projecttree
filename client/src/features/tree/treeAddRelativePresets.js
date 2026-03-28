import { RELATION_TYPES } from "@/lib/relationTypes.js";

/** Быстрые типы связи в меню древа / карточке. */
export const QUICK_ADD_RELATIONS = [
  { label: "Отец", relationType: "отец", line: "male" },
  { label: "Мать", relationType: "мать", line: "female" },
  { label: "Сын", relationType: "сын", line: "" },
  { label: "Дочь", relationType: "дочь", line: "" },
  { label: "Муж", relationType: "муж", line: "male" },
  { label: "Жена", relationType: "жена", line: "female" },
  { label: "Брат", relationType: "брат", line: "" },
  { label: "Сестра", relationType: "сестра", line: "" },
];

const quickSet = new Set(QUICK_ADD_RELATIONS.map((q) => q.relationType));

export function getMoreRelationTypes() {
  return RELATION_TYPES.filter((t) => !quickSet.has(t));
}

export function relationNeedsLine(relationType) {
  return !["дочь", "сын", "брат", "сестра"].includes(String(relationType || "").toLowerCase());
}

/**
 * Линия для API, если пользователь не выбирает её вручную (режим «с древа»).
 */
export function inferLineForRelation(relationType) {
  const t = String(relationType || "").toLowerCase().trim();
  if (["дочь", "сын", "брат", "сестра"].includes(t)) return "";
  if (["мать", "бабушка", "тётя", "жена", "внучка"].includes(t)) return "female";
  if (["отец", "дедушка", "дядя", "муж", "внук"].includes(t)) return "male";
  return "male";
}
