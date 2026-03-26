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
  // --------------------------
  // 0) Подготовка людей
  // --------------------------
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
      notes: ""
    });
  }

  // --------------------------
  // 1) Базовые связи
  // --------------------------
  const parentEdges = [];  // child -> parent
  const spouseEdges = [];  // a <-> b
  const siblingEdges = []; // a <-> b

  const fatherOf = new Map();  // child -> father
  const motherOf = new Map();  // child -> mother
  const sonsOf = new Map();    // parent -> set(sons)
  const daughtersOf = new Map(); // parent -> set(daughters)

  const spouseOf = new Map(); // id -> set(spouses)

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
      spouseEdges.push({ a: base, b: rel });
      addTo(spouseOf, base, rel);
      addTo(spouseOf, rel, base);
      continue;
    }

    if (kind === "sibling") {
      siblingEdges.push({ a: base, b: rel });
      continue;
    }
  }

  // --------------------------
  // 2) Производные связи (бабушка/дедушка/внук/внучка/дядя/тётя)
  // + placeholders если нужно
  // --------------------------
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
      parentEdges.push({ child: vid, parent: parentId });
      addTo(sonsOf, parentId, vid);
      return vid;
    }

    if (line === "female") {
      const d = pickFirst(daughtersOf.get(parentId));
      if (d) return d;
      const vid = `v:${parentId}:daughter`;
      if (!byId.has(vid)) byId.set(vid, makeVirtual(vid, "Дочь (не заполнена)", "F"));
      parentEdges.push({ child: vid, parent: parentId });
      addTo(daughtersOf, parentId, vid);
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
      continue;
    }
  }

  // --------------------------
  // 3) СИБЛИНГИ: наследование родителей
  // Требование: если "брат/сестра", то связь с родителями тоже должна строиться.
  // --------------------------
  const parentsOf = new Map(); // child -> Set(parents)
  const childrenOf = new Map(); // parent -> Set(children)

  function rebuildParentMaps() {
    parentsOf.clear();
    childrenOf.clear();
    for (const e of parentEdges) {
      addTo(parentsOf, e.child, e.parent);
      addTo(childrenOf, e.parent, e.child);
    }
  }

  rebuildParentMaps();

  // добавим родительские связи для братьев/сестер
  for (const s of siblingEdges) {
    const a = s.a;
    const b = s.b;

    const pa = parentsOf.get(a);
    const pb = parentsOf.get(b);

    if (pa && (!pb || pb.size === 0)) {
      for (const p of pa) parentEdges.push({ child: b, parent: p });
    }
    if (pb && (!pa || pa.size === 0)) {
      for (const p of pb) parentEdges.push({ child: a, parent: p });
    }

    // даже если у обоих есть родители - объединяем (на случай неполного ввода)
    if (pa && pb) {
      for (const p of pa) parentEdges.push({ child: b, parent: p });
      for (const p of pb) parentEdges.push({ child: a, parent: p });
    }
  }

  // убираем дубли parentEdges
  const seenPE = new Set();
  const parentEdgesUnique = [];
  for (const e of parentEdges) {
    const k = `${e.child}|${e.parent}`;
    if (seenPE.has(k)) continue;
    seenPE.add(k);
    parentEdgesUnique.push(e);
  }
  parentEdges.length = 0;
  parentEdges.push(...parentEdgesUnique);

  rebuildParentMaps();

  // --------------------------
  // 4) Поколения (gen) от "Я"
  // --------------------------
  const gen = new Map();
  const q = [];
  if (mePersonId) {
    gen.set(mePersonId, 0);
    q.push(mePersonId);
  }

  const adj = new Map();
  function addAdj(a, b, delta) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, delta });
  }

  for (const e of parentEdges) {
    addAdj(e.child, e.parent, -1);
    addAdj(e.parent, e.child, +1);
  }

  for (const e of spouseEdges) {
    addAdj(e.a, e.b, 0);
    addAdj(e.b, e.a, 0);
  }

  for (const e of siblingEdges) {
    addAdj(e.a, e.b, 0);
    addAdj(e.b, e.a, 0);
  }

  while (q.length) {
    const cur = q.shift();
    const baseG = gen.get(cur);
    const outs = adj.get(cur) || [];
    for (const o of outs) {
      if (!gen.has(o.to)) {
        gen.set(o.to, baseG + o.delta);
        q.push(o.to);
      }
    }
  }

  // неразмещенные
  const unplacedIds = [];
  for (const id of byId.keys()) {
    if (!gen.has(id)) unplacedIds.push(id);
  }

  // --------------------------
  // 5) Семейные блоки (unit): либо один человек, либо пара супругов в одной рамке
  // --------------------------
  const unitOfPerson = new Map(); // personId -> unitId
  const units = new Map(); // unitId -> {id, persons:[a] or [a,b], gen, virtual?}

  function makeUnitId(a, b) {
    if (!b) return `u:${a}`;
    const x = a < b ? a : b;
    const y = a < b ? b : a;
    return `u:${x}+${y}`;
  }

  // человек может иметь нескольких супругов, но для красивого блока берем "первого"
  const paired = new Set();
  for (const id of byId.keys()) {
    if (paired.has(id)) continue;
    const ss = spouseOf.get(id);
    const spouse = ss ? pickFirst(ss) : "";
    if (spouse && byId.has(spouse) && !paired.has(spouse)) {
      const uid = makeUnitId(id, spouse);
      units.set(uid, {
        id: uid,
        persons: [id, spouse].sort(),
        gen: gen.get(id) ?? 0,
        virtual: !!byId.get(id)?.isVirtual || !!byId.get(spouse)?.isVirtual
      });
      unitOfPerson.set(id, uid);
      unitOfPerson.set(spouse, uid);
      paired.add(id);
      paired.add(spouse);
    } else {
      const uid = makeUnitId(id, "");
      units.set(uid, {
        id: uid,
        persons: [id],
        gen: gen.get(id) ?? 0,
        virtual: !!byId.get(id)?.isVirtual
      });
      unitOfPerson.set(id, uid);
      paired.add(id);
    }
  }

  // только то, что связано с "Я"
  const connectedUnits = new Map();
  for (const [uid, u] of units.entries()) {
    const any = u.persons[0];
    if (gen.has(any)) connectedUnits.set(uid, u);
  }

  // --------------------------
  // 6) Построение ребер unit->unit (родители над детьми) и расчёт X через выравнивание по детям
  // --------------------------
  const unitParents = new Map();  // unitId(child) -> Set(unitId(parent))
  const unitChildren = new Map(); // unitId(parent) -> Set(unitId(child))

  function addUnitEdge(childPerson, parentPerson) {
    const cu = unitOfPerson.get(childPerson);
    const pu = unitOfPerson.get(parentPerson);
    if (!cu || !pu) return;
    addTo(unitParents, cu, pu);
    addTo(unitChildren, pu, cu);
  }

  for (const e of parentEdges) addUnitEdge(e.child, e.parent);

  // уровни (по gen) но в терминах unit
  const levelUnits = new Map(); // g -> [unitId]
  let minG = 0, maxG = 0;

  for (const [uid, u] of connectedUnits.entries()) {
    const g = u.gen ?? 0;
    if (!levelUnits.has(g)) levelUnits.set(g, []);
    levelUnits.get(g).push(uid);
    minG = Math.min(minG, g);
    maxG = Math.max(maxG, g);
  }

  const levels = [];
  for (let g = minG; g <= maxG; g++) {
    const arr = levelUnits.get(g) || [];
    arr.sort((a, b) => {
      const ua = connectedUnits.get(a);
      const ub = connectedUnits.get(b);
      const na = fmtName(byId.get(ua.persons[0])).toLowerCase();
      const nb = fmtName(byId.get(ub.persons[0])).toLowerCase();
      return na.localeCompare(nb, "ru");
    });
    levels.push({ g, units: arr });
  }

  // размеры блоков
  const UNIT_HALF_W_SINGLE = 110;
  const UNIT_HALF_W_COUPLE = 200;
  const UNIT_MIN_GAP = 40;
  const GAP_Y = 200;

  function unitHalfW(uid) {
    const u = connectedUnits.get(uid);
    if (!u) return UNIT_HALF_W_SINGLE;
    return u.persons.length === 2 ? UNIT_HALF_W_COUPLE : UNIT_HALF_W_SINGLE;
  }

  // начальные X
  const x = new Map(); // unitId -> x
  for (const lvl of levels) {
    const n = lvl.units.length;
    const baseGap = 420;
    const start = -((n - 1) * baseGap) / 2;
    lvl.units.forEach((uid, i) => x.set(uid, start + i * baseGap));
  }

  // выравнивание по детям/родителям (несколько проходов)
  function enforceSpacing(lvl) {
    const arr = lvl.units.slice().sort((a, b) => (x.get(a) || 0) - (x.get(b) || 0));
    for (let i = 1; i < arr.length; i++) {
      const left = arr[i - 1];
      const cur = arr[i];
      const minDist = unitHalfW(left) + unitHalfW(cur) + UNIT_MIN_GAP;
      const need = (x.get(left) || 0) + minDist;
      if ((x.get(cur) || 0) < need) x.set(cur, need);
    }
  }

  function baryCenterByChildren(uid) {
    const cs = unitChildren.get(uid);
    if (!cs || cs.size === 0) return null;
    const arr = [...cs].filter((c) => x.has(c));
    if (arr.length === 0) return null;
    const s = arr.reduce((acc, id) => acc + (x.get(id) || 0), 0);
    return s / arr.length;
  }

  function baryCenterByParents(uid) {
    const ps = unitParents.get(uid);
    if (!ps || ps.size === 0) return null;
    const arr = [...ps].filter((p) => x.has(p));
    if (arr.length === 0) return null;
    const s = arr.reduce((acc, id) => acc + (x.get(id) || 0), 0);
    return s / arr.length;
  }

  const ITER = 8;
  for (let it = 0; it < ITER; it++) {
    // сверху вниз: подгоняем родителей под детей
    for (let li = 0; li < levels.length; li++) {
      const lvl = levels[li];
      for (const uid of lvl.units) {
        const bc = baryCenterByChildren(uid);
        if (bc !== null) x.set(uid, (x.get(uid) || 0) * 0.35 + bc * 0.65);
      }
      enforceSpacing(lvl);
    }

    // снизу вверх: подгоняем детей под родителей (чтобы не было сильных перекосов)
    for (let li = levels.length - 1; li >= 0; li--) {
      const lvl = levels[li];
      for (const uid of lvl.units) {
        const bc = baryCenterByParents(uid);
        if (bc !== null) x.set(uid, (x.get(uid) || 0) * 0.55 + bc * 0.45);
      }
      enforceSpacing(lvl);
    }
  }

  // --------------------------
  // 7) Перевод unit в реальные координаты stage + построение узлов/семейных блоков
  // --------------------------
  const PADDING = 240;

  // вычислим границы по X с учетом ширины блоков
  let minX = Infinity, maxX = -Infinity;
  for (const lvl of levels) {
    for (const uid of lvl.units) {
      const cx = x.get(uid) || 0;
      const hw = unitHalfW(uid);
      minX = Math.min(minX, cx - hw);
      maxX = Math.max(maxX, cx + hw);
    }
  }
  if (!isFinite(minX)) {
    minX = -800;
    maxX = 800;
  }

  const shiftX = PADDING - minX;
  const stageW = (maxX - minX) + PADDING * 2;
  const stageH = (maxG - minG + 1) * GAP_Y + PADDING * 2;

  // позиция unit (центр блока)
  const unitPos = new Map(); // unitId -> {x,y}
  for (const lvl of levels) {
    const y0 = PADDING + (lvl.g - minG) * GAP_Y;
    for (const uid of lvl.units) {
      unitPos.set(uid, { x: (x.get(uid) || 0) + shiftX, y: y0 });
    }
  }

  // узлы для отрисовки: семейные блоки и одиночные
  const drawUnits = [];
  for (const lvl of levels) {
    for (const uid of lvl.units) {
      const u = connectedUnits.get(uid);
      const pos0 = unitPos.get(uid);
      if (!u || !pos0) continue;
      drawUnits.push({
        unitId: uid,
        x: pos0.x,
        y: pos0.y,
        persons: u.persons.map((id) => byId.get(id)).filter(Boolean),
        virtual: !!u.virtual
      });
    }
  }

  // --------------------------
  // 8) Ребра: кривые ветки (Bezier)
  // --------------------------
  function curvePath(x1, y1, x2, y2) {
    const dy = Math.max(40, Math.abs(y2 - y1) * 0.55);
    const c1x = x1;
    const c1y = y1 + (y2 > y1 ? dy : -dy);
    const c2x = x2;
    const c2y = y2 > y1 ? (y2 - dy) : (y2 + dy);
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }

  // edges parent (unit->unit)
  const edgeSet = new Set();
  const edges = [];

  for (const [pu, cs] of unitChildren.entries()) {
    const ppos = unitPos.get(pu);
    if (!ppos) continue;
    for (const cu of cs) {
      const cpos = unitPos.get(cu);
      if (!cpos) continue;
      const k = `parent:${pu}:${cu}`;
      if (edgeSet.has(k)) continue;
      edgeSet.add(k);

      // из нижней части родителя в верхнюю часть ребенка
      edges.push({
        kind: "parent", from: pu, to: cu,
        d: curvePath(ppos.x, ppos.y + 42, cpos.x, cpos.y - 42)
      });
    }
  }

  // spouse edges: тонкая дуга между супругами (между центрами внутри блока мы не рисуем, только между разными блоками)
  // если супруги находятся в одном family-unit - не нужно отдельное ребро
  for (const e of spouseEdges) {
    const a = e.a;
    const b = e.b;
    const ua = unitOfPerson.get(a);
    const ub = unitOfPerson.get(b);
    if (!ua || !ub) continue;
    if (ua === ub) continue;

    const pa = unitPos.get(ua);
    const pb = unitPos.get(ub);
    if (!pa || !pb) continue;

    const k = `spouse:${ua}:${ub}`;
    if (edgeSet.has(k)) continue;
    edgeSet.add(k);

    edges.push({
      kind: "spouse", from: ua, to: ub,
      d: curvePath(pa.x, pa.y, pb.x, pb.y)
    });
  }

  // sibling edges
  for (const e of siblingEdges) {
    const ua = unitOfPerson.get(e.a);
    const ub = unitOfPerson.get(e.b);
    if (!ua || !ub) continue;
    if (ua === ub) continue;

    const pa = unitPos.get(ua);
    const pb = unitPos.get(ub);
    if (!pa || !pb) continue;

    const a = ua < ub ? ua : ub;
    const b = ua < ub ? ub : ua;
    const k = `sib:${a}:${b}`;
    if (edgeSet.has(k)) continue;
    edgeSet.add(k);

    edges.push({
      kind: "sibling", from: a, to: b,
      d: curvePath(pa.x, pa.y, pb.x, pb.y)
    });
  }

  // --------------------------
  // 9) Неразмещенные люди
  // --------------------------
  unplacedIds.sort((a, b) => fmtName(byId.get(a)).localeCompare(fmtName(byId.get(b)), "ru"));
  const unplaced = unplacedIds.map((id) => byId.get(id)).filter(Boolean);

  return {
    stage: { w: Math.max(1600, stageW), h: Math.max(900, stageH) },
    units: drawUnits,
    edges,
    unplaced
  };
}
