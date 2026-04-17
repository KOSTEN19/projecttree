// @ts-nocheck
import type { RelationshipClient } from "@/types/api";

export function strId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.toString === "function") return v.toString();
  return String(v);
}
export function pId(p) {
  return strId(p?.id || p?._id || "");
}
export function safeText(v) {
  return (v || "").toString().trim();
}
export function fmtName(p) {
  return [p?.lastName, p?.firstName].filter(Boolean).join(" ").trim() || "Без имени";
}
export function fmtFullName(p) {
  return [p?.lastName, p?.firstName, p?.middleName].filter(Boolean).join(" ").trim() || "Без имени";
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

function addTo(map, key, val) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(val);
}
function pickFirst(setOrArr) {
  if (!setOrArr) return "";
  if (Array.isArray(setOrArr)) return setOrArr[0] || "";
  for (const x of setOrArr) return x;
  return "";
}

function makeVirtual(id, label, sex = "") {
  return {
    id,
    isVirtual: true,
    isPlaceholder: true,
    isSelf: false,
    lastName: "",
    firstName: label,
    middleName: "",
    sex,
    birthDate: "",
    birthCity: "",
    birthCityCustom: "",
    phone: "",
    alive: true,
    deathDate: "",
    burialPlace: "",
    burialPlaceCustom: "",
    notes: "Это placeholder-узел. Заполни реального человека во вкладке 'Родственники'."
  };
}

export function buildGraphSmart({ mePersonId, people, relationships }) {
  const byId = new Map();
  for (const p of people || []) {
    const id = pId(p);
    if (!id) continue;
    byId.set(id, { ...p, id });
  }
  if (mePersonId && !byId.has(mePersonId)) {
    byId.set(mePersonId, {
      id: mePersonId,
      isSelf: true,
      lastName: "",
      firstName: "Я",
      middleName: "",
      sex: "",
      birthDate: "",
      birthCity: "",
      birthCityCustom: "",
      phone: "",
      alive: true,
      deathDate: "",
      burialPlace: "",
      burialPlaceCustom: "",
      notes: "",
    });
  }

  const parentEdges = [];
  const spouseEdges = [];
  const siblingEdges = [];
  const fatherOf = new Map();
  const motherOf = new Map();
  const sonsOf = new Map();
  const daughtersOf = new Map();

  function canRenderMarriage(basePerson, relatedPerson, relationType) {
    const t = String(relationType || "").toLowerCase().trim();
    const baseSex = String(basePerson?.sex || "").trim();
    const relatedSex = String(relatedPerson?.sex || "").trim();
    if (baseSex && relatedSex && baseSex === relatedSex) return false;
    if (t === "муж") {
      if (baseSex && baseSex !== "F") return false;
      if (relatedSex && relatedSex !== "M") return false;
    }
    if (t === "жена") {
      if (baseSex && baseSex !== "M") return false;
      if (relatedSex && relatedSex !== "F") return false;
    }
    return true;
  }

  for (const r of relationships || []) {
    const base = strId(r.basePersonId);
    const rel = strId(r.relatedPersonId);
    const t = String(r.relationType || "");
    const kind = relKind(t);
    if (!base || !rel) continue;
    if (!byId.has(base) || !byId.has(rel)) continue;

    if (kind === "parent") {
      parentEdges.push({ child: base, parent: rel });
      if (t === "отец" && !fatherOf.has(base)) fatherOf.set(base, rel);
      if (t === "мать" && !motherOf.has(base)) motherOf.set(base, rel);
      continue;
    }
    if (kind === "child") {
      parentEdges.push({ child: rel, parent: base });
      if (t === "сын") addTo(sonsOf, base, rel);
      if (t === "дочь") addTo(daughtersOf, base, rel);
      continue;
    }
    if (kind === "spouse") {
      if (canRenderMarriage(byId.get(base), byId.get(rel), t)) {
        spouseEdges.push({ a: base, b: rel });
      }
      continue;
    }
    if (kind === "sibling") {
      siblingEdges.push({ a: base, b: rel });
    }
  }

  function ensureFather(childId) {
    const known = fatherOf.get(childId);
    if (known) return known;
    const vid = `v:${childId}:father`;
    if (!byId.has(vid)) byId.set(vid, makeVirtual(vid, "Отец (не заполнен)", "M"));
    fatherOf.set(childId, vid);
    parentEdges.push({ child: childId, parent: vid });
    return vid;
  }
  function ensureMother(childId) {
    const known = motherOf.get(childId);
    if (known) return known;
    const vid = `v:${childId}:mother`;
    if (!byId.has(vid)) byId.set(vid, makeVirtual(vid, "Мать (не заполнена)", "F"));
    motherOf.set(childId, vid);
    parentEdges.push({ child: childId, parent: vid });
    return vid;
  }
  function pickParentByLine(childId, line) {
    if (line === "male") return fatherOf.get(childId) || ensureFather(childId);
    if (line === "female") return motherOf.get(childId) || ensureMother(childId);
    const f = fatherOf.get(childId);
    const m = motherOf.get(childId);
    if (f) return f;
    if (m) return m;
    const vid = `v:${childId}:parent`;
    if (!byId.has(vid)) byId.set(vid, makeVirtual(vid, "Родитель (не заполнен)", ""));
    parentEdges.push({ child: childId, parent: vid });
    return vid;
  }
  function ensureChildByLine(parentId, line) {
    if (line === "male") {
      const s = pickFirst(sonsOf.get(parentId));
      if (s) return s;
      const vid = `v:${parentId}:son`;
      if (!byId.has(vid)) byId.set(vid, makeVirtual(vid, "Сын (не заполнен)", "M"));
      addTo(sonsOf, parentId, vid);
      parentEdges.push({ child: vid, parent: parentId });
      return vid;
    }
    if (line === "female") {
      const d = pickFirst(daughtersOf.get(parentId));
      if (d) return d;
      const vid = `v:${parentId}:daughter`;
      if (!byId.has(vid)) byId.set(vid, makeVirtual(vid, "Дочь (не заполнена)", "F"));
      addTo(daughtersOf, parentId, vid);
      parentEdges.push({ child: vid, parent: parentId });
      return vid;
    }
    const any = pickFirst(sonsOf.get(parentId)) || pickFirst(daughtersOf.get(parentId));
    if (any) return any;
    const vid = `v:${parentId}:child`;
    if (!byId.has(vid)) byId.set(vid, makeVirtual(vid, "Ребенок (не заполнен)", ""));
    parentEdges.push({ child: vid, parent: parentId });
    return vid;
  }

  for (const r of relationships || []) {
    const base = strId(r.basePersonId);
    const rel = strId(r.relatedPersonId);
    const kind = relKind(r.relationType);
    const line = String(r.line || "");
    if (!base || !rel) continue;
    if (!byId.has(base) || !byId.has(rel)) continue;
    if (kind === "grandparent") {
      const parent = pickParentByLine(base, line);
      parentEdges.push({ child: parent, parent: rel });
      continue;
    }
    if (kind === "grandchild") {
      const child = ensureChildByLine(base, line);
      parentEdges.push({ child: rel, parent: child });
      continue;
    }
    if (kind === "uncle") {
      const parent = pickParentByLine(base, line);
      siblingEdges.push({ a: parent, b: rel });
    }
  }

  const parentsOf = new Map();
  function rebuildParentMaps() {
    parentsOf.clear();
    for (const e of parentEdges) addTo(parentsOf, e.child, e.parent);
  }
  rebuildParentMaps();
  for (const s of siblingEdges) {
    const pa = parentsOf.get(s.a);
    const pb = parentsOf.get(s.b);
    if (pa && (!pb || pb.size === 0)) {
      for (const p of pa) parentEdges.push({ child: s.b, parent: p });
    }
    if (pb && (!pa || pa.size === 0)) {
      for (const p of pb) parentEdges.push({ child: s.a, parent: p });
    }
    if (pa && pb) {
      for (const p of pa) parentEdges.push({ child: s.b, parent: p });
      for (const p of pb) parentEdges.push({ child: s.a, parent: p });
    }
  }

  const parentSeen = new Set();
  const parentEdgesUnique = [];
  for (const e of parentEdges) {
    const key = `${e.child}|${e.parent}`;
    if (parentSeen.has(key)) continue;
    parentSeen.add(key);
    parentEdgesUnique.push(e);
  }
  const spouseSeen = new Set();
  const spouseEdgesUnique = [];
  for (const e of spouseEdges) {
    const a = e.a < e.b ? e.a : e.b;
    const b = e.a < e.b ? e.b : e.a;
    const key = `${a}|${b}`;
    if (spouseSeen.has(key)) continue;
    spouseSeen.add(key);
    spouseEdgesUnique.push({ a, b });
  }
  const siblingSeen = new Set();
  const siblingEdgesUnique = [];
  for (const e of siblingEdges) {
    const a = e.a < e.b ? e.a : e.b;
    const b = e.a < e.b ? e.b : e.a;
    const key = `${a}|${b}`;
    if (siblingSeen.has(key)) continue;
    siblingSeen.add(key);
    siblingEdgesUnique.push({ a, b });
  }

  const gen = new Map();
  const queue = [];
  if (mePersonId && byId.has(mePersonId)) {
    gen.set(mePersonId, 0);
    queue.push(mePersonId);
  }
  const adj = new Map();
  function addAdj(a, b, delta) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, delta });
  }
  for (const e of parentEdgesUnique) {
    addAdj(e.child, e.parent, -1);
    addAdj(e.parent, e.child, +1);
  }
  for (const e of spouseEdgesUnique) {
    addAdj(e.a, e.b, 0);
    addAdj(e.b, e.a, 0);
  }
  for (const e of siblingEdgesUnique) {
    addAdj(e.a, e.b, 0);
    addAdj(e.b, e.a, 0);
  }
  while (queue.length) {
    const current = queue.shift();
    const currentGen = gen.get(current);
    const outs = adj.get(current) || [];
    for (const out of outs) {
      if (!gen.has(out.to)) {
        gen.set(out.to, currentGen + out.delta);
        queue.push(out.to);
      }
    }
  }

  const connectedIds = [...byId.keys()].filter((id) => gen.has(id));
  const units = connectedIds.map((id) => ({
    unitId: `u:${id}`,
    personId: id,
    persons: [byId.get(id)],
    gen: gen.get(id) ?? 0,
    virtual: Boolean(byId.get(id)?.isVirtual),
  }));

  const levelsMap = new Map();
  let minG = 0;
  let maxG = 0;
  for (const u of units) {
    if (!levelsMap.has(u.gen)) levelsMap.set(u.gen, []);
    levelsMap.get(u.gen).push(u);
    minG = Math.min(minG, u.gen);
    maxG = Math.max(maxG, u.gen);
  }
  const levels = [];
  for (let g = minG; g <= maxG; g++) {
    const arr = levelsMap.get(g) || [];
    arr.sort((a, b) => fmtName(byId.get(a.personId)).localeCompare(fmtName(byId.get(b.personId)), "ru"));
    levels.push({ g, units: arr });
  }

  const x = new Map();
  const HALF_W = 110;
  const GAP_X = 270;
  const GAP_Y = 200;
  const PADDING = 240;
  const MIN_GAP = 35;
  const unitByPerson = new Map();
  for (const u of units) unitByPerson.set(u.personId, u.unitId);

  for (const lvl of levels) {
    const start = -((lvl.units.length - 1) * GAP_X) / 2;
    lvl.units.forEach((u, idx) => x.set(u.unitId, start + idx * GAP_X));
  }

  const personParents = new Map();
  const personChildren = new Map();
  for (const e of parentEdgesUnique) {
    addTo(personParents, e.child, e.parent);
    addTo(personChildren, e.parent, e.child);
  }
  function barycenterByChildren(personId) {
    const children = personChildren.get(personId);
    if (!children || children.size === 0) return null;
    const xs = [...children]
      .map((id) => unitByPerson.get(id))
      .filter(Boolean)
      .map((uid) => x.get(uid))
      .filter((v) => Number.isFinite(v));
    if (xs.length === 0) return null;
    return xs.reduce((sum, v) => sum + v, 0) / xs.length;
  }
  function barycenterByParents(personId) {
    const parents = personParents.get(personId);
    if (!parents || parents.size === 0) return null;
    const xs = [...parents]
      .map((id) => unitByPerson.get(id))
      .filter(Boolean)
      .map((uid) => x.get(uid))
      .filter((v) => Number.isFinite(v));
    if (xs.length === 0) return null;
    return xs.reduce((sum, v) => sum + v, 0) / xs.length;
  }
  function enforceSpacing(level) {
    const sorted = [...level.units].sort((a, b) => (x.get(a.unitId) || 0) - (x.get(b.unitId) || 0));
    for (let i = 1; i < sorted.length; i++) {
      const left = sorted[i - 1];
      const cur = sorted[i];
      const need = (x.get(left.unitId) || 0) + HALF_W * 2 + MIN_GAP;
      if ((x.get(cur.unitId) || 0) < need) x.set(cur.unitId, need);
    }
  }
  for (let i = 0; i < 8; i++) {
    for (const level of levels) {
      for (const u of level.units) {
        const bc = barycenterByChildren(u.personId);
        if (bc !== null) x.set(u.unitId, (x.get(u.unitId) || 0) * 0.35 + bc * 0.65);
      }
      enforceSpacing(level);
    }
    for (let li = levels.length - 1; li >= 0; li--) {
      const level = levels[li];
      for (const u of level.units) {
        const bc = barycenterByParents(u.personId);
        if (bc !== null) x.set(u.unitId, (x.get(u.unitId) || 0) * 0.55 + bc * 0.45);
      }
      enforceSpacing(level);
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  for (const level of levels) {
    for (const u of level.units) {
      const cx = x.get(u.unitId) || 0;
      minX = Math.min(minX, cx - HALF_W);
      maxX = Math.max(maxX, cx + HALF_W);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = -800;
    maxX = 800;
  }
  const shiftX = PADDING - minX;
  const stageW = maxX - minX + PADDING * 2;
  const stageH = (maxG - minG + 1) * GAP_Y + PADDING * 2;
  const pos = new Map();
  for (const level of levels) {
    const y = PADDING + (level.g - minG) * GAP_Y;
    for (const u of level.units) {
      pos.set(u.unitId, { x: (x.get(u.unitId) || 0) + shiftX, y });
    }
  }

  function curvePath(x1, y1, x2, y2) {
    const dy = Math.max(40, Math.abs(y2 - y1) * 0.55);
    const c1x = x1;
    const c1y = y1 + (y2 > y1 ? dy : -dy);
    const c2x = x2;
    const c2y = y2 > y1 ? y2 - dy : y2 + dy;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }

  const drawUnits = units
    .map((u) => {
      const p = pos.get(u.unitId);
      if (!p) return null;
      return { unitId: u.unitId, x: p.x, y: p.y, persons: u.persons, virtual: u.virtual };
    })
    .filter(Boolean);

  const edges = [];
  const edgeSet = new Set();
  for (const e of parentEdgesUnique) {
    const from = unitByPerson.get(e.parent);
    const to = unitByPerson.get(e.child);
    if (!from || !to || from === to) continue;
    const a = pos.get(from);
    const b = pos.get(to);
    if (!a || !b) continue;
    const key = `parent:${from}:${to}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({ kind: "parent", from, to, d: curvePath(a.x, a.y + 42, b.x, b.y - 42) });
  }
  for (const e of spouseEdgesUnique) {
    const from = unitByPerson.get(e.a);
    const to = unitByPerson.get(e.b);
    if (!from || !to || from === to) continue;
    const a = pos.get(from);
    const b = pos.get(to);
    if (!a || !b) continue;
    const key = from < to ? `spouse:${from}:${to}` : `spouse:${to}:${from}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({ kind: "spouse", from, to, d: curvePath(a.x, a.y, b.x, b.y) });
  }
  for (const e of siblingEdgesUnique) {
    const from = unitByPerson.get(e.a);
    const to = unitByPerson.get(e.b);
    if (!from || !to || from === to) continue;
    const a = pos.get(from);
    const b = pos.get(to);
    if (!a || !b) continue;
    const key = from < to ? `sibling:${from}:${to}` : `sibling:${to}:${from}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({ kind: "sibling", from, to, d: curvePath(a.x, a.y, b.x, b.y) });
  }

  const unplaced = [...byId.keys()]
    .filter((id) => !gen.has(id))
    .sort((a, b) => fmtName(byId.get(a)).localeCompare(fmtName(byId.get(b)), "ru"))
    .map((id) => byId.get(id))
    .filter(Boolean);

  return {
    stage: { w: Math.max(1600, stageW), h: Math.max(900, stageH) },
    units: drawUnits,
    edges,
    unplaced,
    personParentLinks: parentEdgesUnique.map((e) => ({ child: e.child, parent: e.parent })),
  };
}
