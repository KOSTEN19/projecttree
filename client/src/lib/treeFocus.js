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

/** Убрать из множества людей, связанных с anchor указанным типом связи (напр. дядя по отцу при линии матери). */
function stripAnchorRelations(keep, anchorId, relationships, relationTypeLower) {
  const want = String(relationTypeLower || "").toLowerCase();
  if (!want) return;
  for (const r of relationships || []) {
    if (strId(r.basePersonId) !== anchorId) continue;
    if (String(r.relationType || "").toLowerCase() !== want) continue;
    keep.delete(strId(r.relatedPersonId));
  }
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

/** Все строгие предки personId (без него самого). */
function strictAncestorsOf(personId, fatherOf, motherOf) {
  return ancestorsUpward(personId, fatherOf, motherOf);
}

function buildChildrenMap(relationships, byId) {
  const childrenOf = new Map();
  function addChild(parentId, childId) {
    if (!parentId || !childId || !byId.has(parentId) || !byId.has(childId)) return;
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, new Set());
    childrenOf.get(parentId).add(childId);
  }
  for (const r of relationships || []) {
    const base = strId(r.basePersonId);
    const rel = strId(r.relatedPersonId);
    const t = String(r.relationType || "").toLowerCase();
    if (!byId.has(base) || !byId.has(rel)) continue;
    if (t === "отец" || t === "мать") addChild(rel, base);
    if (t === "сын" || t === "дочь") addChild(base, rel);
  }
  return childrenOf;
}

function collectDescendantsFrom(startId, childrenOf) {
  const s = new Set();
  const q = [startId];
  s.add(startId);
  while (q.length) {
    const v = q.shift();
    for (const c of childrenOf.get(v) || []) {
      if (!s.has(c)) {
        s.add(c);
        q.push(c);
      }
    }
  }
  return s;
}

/** Цепочка только вверх по отцу/матери: me → … → target (target должен быть предком). */
function pathUpToAncestor(me, target, fatherOf, motherOf) {
  if (me === target) return [me];
  const q = [[me]];
  const vis = new Set([me]);
  while (q.length) {
    const path = q.shift();
    const v = path[path.length - 1];
    for (const p of [fatherOf.get(v), motherOf.get(v)]) {
      if (!p || vis.has(p)) continue;
      const next = [...path, p];
      if (p === target) return next;
      vis.add(p);
      q.push(next);
    }
  }
  return null;
}

/** Цепочка только вниз по детям: me → … → target (target должен быть потомком). */
function pathDownToDescendant(me, target, childrenOf) {
  if (me === target) return [me];
  const q = [[me]];
  const vis = new Set([me]);
  while (q.length) {
    const path = q.shift();
    const v = path[path.length - 1];
    for (const c of childrenOf.get(v) || []) {
      if (vis.has(c)) continue;
      const next = [...path, c];
      if (c === target) return next;
      vis.add(c);
      q.push(next);
    }
  }
  return null;
}

/** Рёбра только родитель–ребёнок (без супругов, братьев и т.д.) — для осмысленной «ветки». */
function buildParentChildAdj(relationships, byId) {
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
    const t = String(r.relationType || "").toLowerCase();
    if (!byId.has(base) || !byId.has(rel)) continue;
    if (t === "отец" || t === "мать" || t === "сын" || t === "дочь") addEdge(base, rel);
  }
  return adj;
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

  let keep;

  if (focus.type === "paternal") {
    const anchorId = focus.anchorId ? strId(focus.anchorId) : mePersonId;
    if (!byId.has(anchorId)) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    const mo = motherOf.get(anchorId);
    const fa = fatherOf.get(anchorId);
    if (!mo) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    if (!fa) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    const blockEdge = fa && mo ? (fa < mo ? `${fa}|${mo}` : `${mo}|${fa}`) : null;
    // Линия отца: всё, достижимо от отца без захода к матери (и без ребра супругов между ними).
    keep = bfsFrom(fa, mo, adj, blockEdge);
    keep.add(anchorId);
    stripAnchorRelations(keep, anchorId, relationships, "тётя");
    if (anchorId !== mePersonId) {
      const path = shortestPath(adj, mePersonId, anchorId);
      if (path) path.forEach((id) => keep.add(id));
    }
  } else if (focus.type === "maternal") {
    const anchorId = focus.anchorId ? strId(focus.anchorId) : mePersonId;
    if (!byId.has(anchorId)) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    const mo = motherOf.get(anchorId);
    const fa = fatherOf.get(anchorId);
    if (!mo) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    const blockEdge = fa && mo ? (fa < mo ? `${fa}|${mo}` : `${mo}|${fa}`) : null;
    // Линия матери: всё, достижимо от матери без захода к отцу. Раньше использовался дополнение к BFS от отца
    // с блокировкой якоря — родственники только по связи с якорем (дядя по отцу) ошибочно попадали в кадр.
    keep = bfsFrom(mo, fa, adj, blockEdge);
    keep.add(anchorId);
    stripAnchorRelations(keep, anchorId, relationships, "дядя");
    if (anchorId !== mePersonId) {
      const path = shortestPath(adj, mePersonId, anchorId);
      if (path) path.forEach((id) => keep.add(id));
    }
  } else if (focus.type === "lineage" && focus.anchorId) {
    const anchor = strId(focus.anchorId);
    if (anchor === mePersonId) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }
    if (!byId.has(anchor)) {
      return { mePersonId, people: [...(people || [])], relationships: [...(relationships || [])] };
    }

    const childrenOf = buildChildrenMap(relationships, byId);
    const myAncestors = strictAncestorsOf(mePersonId, fatherOf, motherOf);
    const myDescendants = collectDescendantsFrom(mePersonId, childrenOf);

    if (myAncestors.has(anchor)) {
      const path = pathUpToAncestor(mePersonId, anchor, fatherOf, motherOf);
      keep = new Set(path || [mePersonId, anchor]);
      ancestorsUpward(anchor, fatherOf, motherOf).forEach((id) => keep.add(id));
    } else if (anchor !== mePersonId && myDescendants.has(anchor)) {
      const path = pathDownToDescendant(mePersonId, anchor, childrenOf);
      keep = new Set(path || [mePersonId, anchor]);
    } else {
      const adjPC = buildParentChildAdj(relationships, byId);
      let path = shortestPath(adjPC, mePersonId, anchor);
      if (!path) path = shortestPath(adj, mePersonId, anchor);
      keep = new Set(path || [mePersonId, anchor]);
      if (!myDescendants.has(anchor)) {
        ancestorsUpward(anchor, fatherOf, motherOf).forEach((id) => keep.add(id));
      }
    }
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
 * Волны подсветки ветки: от «корней» (нет родителя внутри keep) к периферии по рёбрам связей внутри keep.
 * @param {Set<string>|string[]} keep
 * @returns {string[][]}
 */
export function computeFocusRevealWaves(keep, fatherOf, motherOf, relationships) {
  const K = keep instanceof Set ? keep : new Set(keep);
  if (K.size === 0) return [];

  const inducedAdj = new Map();
  for (const id of K) inducedAdj.set(id, new Set());
  for (const r of relationships || []) {
    const a = strId(r.basePersonId);
    const b = strId(r.relatedPersonId);
    if (!K.has(a) || !K.has(b)) continue;
    inducedAdj.get(a).add(b);
    inducedAdj.get(b).add(a);
  }

  const roots = [...K].filter((id) => {
    const f = fatherOf.get(id);
    const m = motherOf.get(id);
    return !((f && K.has(f)) || (m && K.has(m)));
  });

  const waves = [];
  const visited = new Set();
  let frontier = roots.length > 0 ? [...new Set(roots)].sort() : [[...K][0]].filter(Boolean);

  while (frontier.length) {
    waves.push(frontier);
    for (const id of frontier) visited.add(id);
    const next = new Set();
    for (const id of frontier) {
      for (const w of inducedAdj.get(id) || []) {
        if (!visited.has(w)) next.add(w);
      }
    }
    frontier = [...next].sort();
  }

  for (const id of K) {
    if (visited.has(id)) continue;
    let f2 = [id];
    while (f2.length) {
      waves.push(f2);
      for (const x of f2) visited.add(x);
      const next = new Set();
      for (const x of f2) {
        for (const w of inducedAdj.get(x) || []) {
          if (!visited.has(w)) next.add(w);
        }
      }
      f2 = [...next].sort();
    }
  }

  return waves.length > 0 ? waves : [[...K]];
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
