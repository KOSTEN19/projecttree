/** Фильтрация данных древа: отцовская / материнская линия или прямая линия к предку. */

function strId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.toString === "function") return v.toString();
  return String(v);
}

export function pId(p) {
  return strId(p?.id || p?._id || "");
}

function relKind(relationType) {
  const t = String(relationType || "").toLowerCase();
  if (t === "мать" || t === "отец") return "parent";
  if (t === "сын" || t === "дочь") return "child";
  if (t === "жена" || t === "муж") return "spouse";
  if (t === "брат" || t === "сестра") return "sibling";
  if (t === "бабушка" || t === "дедушка") return "grandparent";
  if (t === "внук" || t === "внучка") return "grandchild";
  if (t === "дядя" || t === "тётя") return "uncle";
  return "unknown";
}

function extractParentMaps(relationships, byId) {
  const fatherOf = new Map();
  const motherOf = new Map();
  for (const r of relationships || []) {
    const base = strId(r.basePersonId);
    const rel = strId(r.relatedPersonId);
    const t = String(r.relationType || "");
    const kind = relKind(t);
    if (!base || !rel) continue;
    if (!byId.has(base) || !byId.has(rel)) continue;
    if (kind === "parent") {
      if (t === "отец" && !fatherOf.has(base)) fatherOf.set(base, rel);
      if (t === "мать" && !motherOf.has(base)) motherOf.set(base, rel);
    }
  }
  return { fatherOf, motherOf };
}

function buildUndirectedAdj(relationships, byId) {
  const adj = new Map();
  function addEdge(a, b) {
    if (!a || !b || a === b) return;
    if (!byId.has(a) || !byId.has(b)) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  for (const r of relationships || []) {
    const base = strId(r.basePersonId);
    const rel = strId(r.relatedPersonId);
    const kind = relKind(r.relationType);
    if (!base || !rel) continue;
    if (!byId.has(base) || !byId.has(rel)) continue;
    if (kind === "parent" || kind === "child" || kind === "spouse" || kind === "sibling" ||
        kind === "grandparent" || kind === "grandchild" || kind === "uncle") {
      addEdge(base, rel);
    }
  }
  return adj;
}

function bfsFrom(start, blockedVisit, adj, blockedEdgeKey) {
  const vis = new Set();
  const q = [start];
  vis.add(start);
  while (q.length) {
    const v = q.shift();
    for (const w of adj.get(v) || []) {
      if (w === blockedVisit) continue;
      const key = v < w ? `${v}|${w}` : `${w}|${v}`;
      if (blockedEdgeKey && key === blockedEdgeKey) continue;
      if (!vis.has(w)) {
        vis.add(w);
        q.push(w);
      }
    }
  }
  return vis;
}

function shortestPath(adj, from, to) {
  if (from === to) return [from];
  const q = [[from]];
  const vis = new Set([from]);
  while (q.length) {
    const path = q.shift();
    const v = path[path.length - 1];
    for (const w of adj.get(v) || []) {
      if (vis.has(w)) continue;
      if (w === to) return [...path, w];
      vis.add(w);
      q.push([...path, w]);
    }
  }
  return null;
}

/** Предки (родители и выше), без самого anchor. */
function ancestorsUpward(anchor, fatherOf, motherOf) {
  const s = new Set();
  const q = [];
  for (const p of [fatherOf.get(anchor), motherOf.get(anchor)]) {
    if (p && !s.has(p)) {
      s.add(p);
      q.push(p);
    }
  }
  while (q.length) {
    const v = q.shift();
    for (const p of [fatherOf.get(v), motherOf.get(v)]) {
      if (p && !s.has(p)) {
        s.add(p);
        q.push(p);
      }
    }
  }
  return s;
}

/**
 * @param {{ mePersonId: string, people: any[], relationships: any[] }} data
 * @param {null | { type: 'paternal' | 'maternal' | 'lineage', anchorId?: string }} focus
 */
export function applyTreeFocus(data, focus) {
  const { mePersonId, people, relationships } = data;
  if (!focus || focus.type === "full") {
    return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
  }

  const byId = new Map();
  for (const p of people || []) {
    const id = pId(p);
    if (!id) continue;
    byId.set(id, { ...p, id });
  }
  if (!mePersonId || !byId.has(mePersonId)) {
    return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
  }

  const { fatherOf, motherOf } = extractParentMaps(relationships, byId);
  const adj = buildUndirectedAdj(relationships, byId);
  const mo = motherOf.get(mePersonId);
  const fa = fatherOf.get(mePersonId);
  const blockEdge = fa && mo ? (fa < mo ? `${fa}|${mo}` : `${mo}|${fa}`) : null;

  let keep;

  if (focus.type === "paternal") {
    if (!mo) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    const side = bfsFrom(mo, mePersonId, adj, blockEdge);
    keep = new Set([...byId.keys()].filter((id) => !side.has(id)));
  } else if (focus.type === "maternal") {
    if (!fa) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    const side = bfsFrom(fa, mePersonId, adj, blockEdge);
    keep = new Set([...byId.keys()].filter((id) => !side.has(id)));
  } else if (focus.type === "lineage" && focus.anchorId) {
    const anchor = strId(focus.anchorId);
    if (anchor === mePersonId) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    if (!byId.has(anchor)) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    const path = shortestPath(adj, mePersonId, anchor);
    const anc = ancestorsUpward(anchor, fatherOf, motherOf);
    keep = new Set([mePersonId, anchor]);
    if (path) path.forEach((id) => keep.add(id));
    anc.forEach((id) => keep.add(id));
  } else {
    return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
  }

  const newPeople = (people || []).filter((p) => keep.has(pId(p)));
  const newRel = (relationships || []).filter((r) => {
    const a = strId(r.basePersonId);
    const b = strId(r.relatedPersonId);
    return keep.has(a) && keep.has(b);
  });

  return { mePersonId, people: newPeople, relationships: newRel };
}

/**
 * Выбор режима фокуса по клику на человека в древе.
 */
export function focusForClick(mePersonId, clickedId, fatherOf, motherOf) {
  if (!mePersonId || !clickedId) return null;
  if (clickedId === fatherOf.get(mePersonId)) return { type: "paternal" };
  if (clickedId === motherOf.get(mePersonId)) return { type: "maternal" };
  return { type: "lineage", anchorId: clickedId };
}

export function extractParentMapsForTree(relationships, byId) {
  return extractParentMaps(relationships, byId);
}
