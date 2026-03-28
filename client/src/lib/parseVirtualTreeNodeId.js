/**
 * Виртуальные узлы древа (Tree.jsx makeVirtual) имеют id вида v:{mongoId}:{slot}.
 * Возвращает параметры для POST /api/persons (basePersonId + связь от базы к новому человеку).
 */
export function parseVirtualTreeNodeId(pid) {
  const s = String(pid || "");
  if (!s.startsWith("v:")) return null;
  const m = /^v:([a-f0-9]{24}):(father|mother|parent|son|daughter|child)$/i.exec(s);
  if (!m) return null;
  const basePersonId = m[1];
  const slot = m[2].toLowerCase();
  switch (slot) {
    case "father":
      return { basePersonId, relationType: "отец", line: "male" };
    case "mother":
      return { basePersonId, relationType: "мать", line: "female" };
    case "parent":
      return { basePersonId, relationType: "", line: "" };
    case "son":
      return { basePersonId, relationType: "сын", line: "" };
    case "daughter":
      return { basePersonId, relationType: "дочь", line: "" };
    case "child":
      return { basePersonId, relationType: "", line: "" };
    default:
      return null;
  }
}
