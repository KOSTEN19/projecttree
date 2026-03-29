import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { apiGet } from "../api.js";
import AddRelativeStepperForm from "../components/AddRelativeStepperForm.jsx";
import { Av, sx } from "../features/tree/TreeAvatars";
import { TreeAddRelativeRelationPicker } from "../features/tree/TreeAddRelativeRelationPicker.jsx";
import { TreePersonCardOverlay } from "../features/tree/TreePersonCardOverlay";
import { TreePersonPopup } from "../features/tree/TreePersonPopup.jsx";
import { applyTreeFocus, extractParentMapsForTree, focusForClick } from "../lib/treeFocus.js";
import { parseVirtualTreeNodeId } from "../lib/parseVirtualTreeNodeId.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
function strId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.toString === "function") return v.toString();
  return String(v);
}
function pId(p) {
  return strId(p?.id || p?._id || "");
}
function safeText(v) {
  return (v || "").toString().trim();
}
function fmtName(p) {
  return [p?.lastName, p?.firstName].filter(Boolean).join(" ").trim() || "Без имени";
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

function buildGraphSmart({ mePersonId, people, relationships }) {
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
    unplaced,
    /** Рёбра родства на уровне person id (для подсветки ветки с учётом заглушек v:…) */
    personParentLinks: parentEdgesUnique.map((e) => ({ child: e.child, parent: e.parent })),
  };
}

function branchPath(x1, y1, x2, y2, kind) {
  if (kind === "spouse" || kind === "sibling") {
    const bulge = Math.min(50, Math.abs(x2 - x1) * 0.18 + 25);
    return `M ${x1} ${y1} C ${x1} ${y1 - bulge}, ${x2} ${y2 - bulge}, ${x2} ${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

export default function Tree() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ mePersonId: "", people: [], relationships: [] });
  const [branchFocus, setBranchFocus] = useState(null);
  const [err, setErr] = useState("");
  const [card, setCard] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [addRelativeOpen, setAddRelativeOpen] = useState(false);
  const [addRelSession, setAddRelSession] = useState({
    key: 0,
    basePersonId: "",
    relationType: "мать",
    line: "",
  });
  /** { clientX, clientY, person } — всплывающее меню по клику на узел */
  const [personMenu, setPersonMenu] = useState(null);
  /** Диалог выбора типа связи (с древа / из карточки) */
  const [relationPicker, setRelationPicker] = useState(null);
  const vpRef = useRef(null);
  const [pos, setPos] = useState({});
  const [cam, setCam] = useState({ x: 0, y: 0, s: 1 });
  const camDrag = useRef(null);
  const nodeDrag = useRef(null);

  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    if (!card) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setCard(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card]);

  async function load() {
    setLoading(true); setErr("");
    try {
      const d = await apiGet("/api/tree");
      setData({
        mePersonId: strId(d.mePersonId || ""),
        people: (d.people || []).map(p => ({ ...p, id: pId(p) })),
        relationships: d.relationships || [],
      });
    } catch (e) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const selfPerson = useMemo(
    () => (data.people || []).find((p) => p.isSelf) || (data.mePersonId ? { id: data.mePersonId, isSelf: true } : null),
    [data.people, data.mePersonId],
  );

  const openAddRelativeFromTree = useCallback((payload) => {
    setAddRelSession({
      key: Date.now(),
      basePersonId: payload.basePersonId,
      relationType: payload.relationType,
      line: payload.line ?? "",
    });
    setAddRelativeOpen(true);
  }, []);

  const beginRelationPicker = useCallback((basePersonId) => {
    setPersonMenu(null);
    setCard(null);
    setRelationPicker({ basePersonId });
  }, []);

  const onRelationTypePicked = useCallback(
    (payload) => {
      setRelationPicker(null);
      openAddRelativeFromTree(payload);
    },
    [openAddRelativeFromTree],
  );

  const parentMaps = useMemo(() => {
    const byId = new Map();
    for (const p of data.people || []) {
      const id = pId(p);
      if (id) byId.set(id, { ...p, id });
    }
    return extractParentMapsForTree(data.relationships, byId);
  }, [data]);

  const focusData = useMemo(() => applyTreeFocus(data, branchFocus), [data, branchFocus]);
  const focusPersonSet = useMemo(() => {
    const s = new Set();
    for (const p of focusData.people || []) s.add(pId(p));
    return s;
  }, [focusData.people]);
  const g = useMemo(() => buildGraphSmart(data), [data]);

  /** Заглушки v:… не в API — расширяем множество фокуса, чтобы линии и узлы ветки подсвечивались. */
  const bridgedFocusPersonSet = useMemo(() => {
    const K = new Set(focusPersonSet);
    const links = g.personParentLinks;
    if (!branchFocus || !links?.length) return K;
    const t = branchFocus.type;
    const fMap = parentMaps.fatherOf;
    const mMap = parentMaps.motherOf;

    function isFatherStub(childId, parentId) {
      const c = String(childId);
      const p = String(parentId);
      return p.startsWith("v:") && (p === `v:${c}:father` || p.endsWith(":father"));
    }
    function isMotherStub(childId, parentId) {
      const c = String(childId);
      const p = String(parentId);
      return p.startsWith("v:") && (p === `v:${c}:mother` || p.endsWith(":mother"));
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const { child, parent } of links) {
        const pid = String(parent);
        const cid = String(child);
        const pv = pid.startsWith("v:");
        const cv = cid.startsWith("v:");

        if (K.has(child) && pv && !K.has(parent)) {
          if (t === "paternal" && isMotherStub(child, parent)) continue;
          if (t === "maternal" && isFatherStub(child, parent)) continue;
          if (t === "lineage") {
            const mr = mMap.get(child);
            const fr = fMap.get(child);
            if (mr && !K.has(mr) && isMotherStub(child, parent)) continue;
            if (fr && !K.has(fr) && isFatherStub(child, parent)) continue;
          }
          K.add(parent);
          changed = true;
        }
        if (t === "lineage" && K.has(parent) && cv && !K.has(child)) {
          K.add(child);
          changed = true;
        }
      }
    }
    return K;
  }, [branchFocus, focusPersonSet, g.personParentLinks, parentMaps.fatherOf, parentMaps.motherOf]);

  const activeUnitIds = useMemo(() => {
    if (!branchFocus) return null;
    const s = new Set();
    for (const u of g.units) {
      if ((u.persons || []).some((p) => bridgedFocusPersonSet.has(pId(p)))) s.add(u.unitId);
    }
    return s;
  }, [branchFocus, g.units, bridgedFocusPersonSet]);

  const resetCameraToFit = useCallback(() => {
    const el = vpRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const s = Math.min(w / g.stage.w, h / g.stage.h, 1) * 0.82;
    setCam({ x: (w - g.stage.w * s) / 2, y: (h - g.stage.h * s) / 2, s });
  }, [g.stage.w, g.stage.h]);

  useEffect(() => {
    const p = {};
    for (const u of g.units) p[u.unitId] = { x: u.x, y: u.y };
    setPos(p);
    const el = vpRef.current;
    if (el) {
      const w = el.clientWidth, h = el.clientHeight;
      const s = Math.min(w / g.stage.w, h / g.stage.h, 1) * 0.82;
      setCam({ x: (w - g.stage.w * s) / 2, y: (h - g.stage.h * s) / 2, s });
    }
  }, [g]);

  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setCam(c => {
        const f = e.deltaY < 0 ? 1.12 : 0.89;
        const ns = Math.min(3, Math.max(0.15, c.s * f));
        return { x: mx - (mx - c.x) * (ns / c.s), y: my - (my - c.y) * (ns / c.s), s: ns };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onBgDown = (e) => {
    if (e.button !== 0 || nodeDrag.current) return;
    camDrag.current = { sx: e.clientX, sy: e.clientY, ox: cam.x, oy: cam.y, moved: false };
  };

  const onNodeDown = (e, unitId) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p = pos[unitId];
    if (!p) return;
    nodeDrag.current = { unitId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, active: false };
  };

  const onMove = (e) => {
    if (nodeDrag.current) {
      const nd = nodeDrag.current;
      const dx = e.clientX - nd.sx, dy = e.clientY - nd.sy;
      if (!nd.active && Math.abs(dx) + Math.abs(dy) < 5) return;
      nd.active = true;
      suppressNextClickRef.current = true;
      setPos(prev => ({
        ...prev,
        [nd.unitId]: { x: nd.ox + dx / cam.s, y: nd.oy + dy / cam.s }
      }));
      return;
    }
    if (camDrag.current) {
      const cd = camDrag.current;
      const dx = e.clientX - cd.sx;
      const dy = e.clientY - cd.sy;
      if (!cd.moved && Math.abs(dx) + Math.abs(dy) > 4) {
        cd.moved = true;
        suppressNextClickRef.current = true;
      }
      setCam(c => ({ ...c, x: cd.ox + e.clientX - cd.sx, y: cd.oy + e.clientY - cd.sy }));
    }
  };
  const onUp = () => {
    if (nodeDrag.current?.active || camDrag.current?.moved) {
      suppressNextClickRef.current = true;
      setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    }
    nodeDrag.current = null;
    camDrag.current = null;
  };

  const edgePaths = useMemo(() => {
    return g.edges.map(e => {
      const fp = pos[e.from], tp = pos[e.to];
      if (!fp || !tp) return null;
      const y1o = e.kind === "parent" ? 50 : 0;
      const y2o = e.kind === "parent" ? -50 : 0;
      return {
        kind: e.kind,
        from: e.from,
        to: e.to,
        d: branchPath(fp.x, fp.y + y1o, tp.x, tp.y + y2o, e.kind),
      };
    }).filter(Boolean);
  }, [g.edges, pos]);

  const eras = useMemo(() => {
    const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X',
      'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
    const byY = new Map();
    for (const u of g.units) {
      for (const p of u.persons) {
        const y = parseInt((p?.birthDate || "").slice(0, 4), 10);
        if (y > 1000 && y < 2100) {
          if (!byY.has(u.y)) byY.set(u.y, []);
          byY.get(u.y).push(y);
        }
      }
    }
    const result = [];
    for (const [yPos, years] of byY) {
      years.sort((a, b) => a - b);
      const min = years[0];
      const max = years[years.length - 1];
      const avg = Math.round(years.reduce((s, v) => s + v, 0) / years.length);
      let primary, secondary;
      if (avg < 1800) {
        const c = Math.ceil(avg / 100);
        primary = `${ROMAN[c] || c} век`;
        secondary = years.length > 1 ? `${min}–${max}` : `≈ ${avg}`;
      } else {
        const decade = Math.floor(avg / 10) * 10;
        primary = `${decade}-е`;
        secondary = min === max ? `${min} г.` : `${min}–${max}`;
      }
      result.push({ y: yPos, primary, secondary, avg });
    }
    result.sort((a, b) => a.y - b.y);
    return result;
  }, [g.units]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!loading && g.units.length > 0) {
      const t = setTimeout(() => setReady(true), 80);
      return () => clearTimeout(t);
    }
    setReady(false);
  }, [loading, g.units.length]);

  return (
    <div className="tree-route-shell flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="tree-page">
        <div className="tree-actions tree-actions--overlay">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHelpOpen(true)}
            className="gap-1.5"
            title="Как пользоваться древом"
          >
            <CircleHelp className="size-4 shrink-0" aria-hidden />
            Справка
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetCameraToFit}>
            В экран
          </Button>
          {branchFocus ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setBranchFocus(null)}>
              Убрать фокус
            </Button>
          ) : null}
          <Button type="button" variant="default" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "…" : "Обновить"}
          </Button>
        </div>

        {err ? (
          <Alert variant="destructive" className="tree-err">
            <AlertTitle>Ошибка загрузки</AlertTitle>
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        <div
          ref={vpRef}
          className="tree-viewport"
          onMouseDown={onBgDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          role="application"
          aria-label="Полотно древа: перетаскивание перемещает вид, колёсико меняет масштаб"
        >
          <div
            className="tree-stage"
            style={{
              transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`,
              width: g.stage.w,
              height: g.stage.h,
            }}
          >
            {eras.length > 0 ? (
              <div className="tree-eras">
                {eras.length > 1 ? (
                  <div
                    className="tree-era-timeline"
                    style={{
                      top: eras[0].y,
                      height: eras[eras.length - 1].y - eras[0].y,
                    }}
                  />
                ) : null}
                {eras.map((era, i) => (
                  <div key={i} className="tree-era" style={{ top: era.y, width: g.stage.w }}>
                    <div className="tree-era-line" />
                    <div className="tree-era-dot" />
                    <div className="tree-era-badge">
                      <span className="tree-era-primary">{era.primary}</span>
                      <span className="tree-era-secondary">{era.secondary}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <svg className="tree-edges" width={g.stage.w} height={g.stage.h} aria-hidden>
              <defs>
                <filter id="treeSvgGlow" x="-35%" y="-35%" width="170%" height="170%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="0 0 0 0 0.62  0 0 0 0 0.50  0 0 0 0 0.36  0 0 0 0.24 0"
                    result="glow"
                  />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="treeStrokeParent" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8eb0d9" stopOpacity="0.86" />
                  <stop offset="48%" stopColor="#bfd3e7" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#9db7d8" stopOpacity="0.84" />
                </linearGradient>
                <linearGradient id="treeStrokeSpouse" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#c09ab3" stopOpacity="0.82" />
                  <stop offset="50%" stopColor="#e1c4d4" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#b88ba7" stopOpacity="0.82" />
                </linearGradient>
                <linearGradient id="treeStrokeSibling" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9ca8d8" stopOpacity="0.78" />
                  <stop offset="100%" stopColor="#c5cfee" stopOpacity="0.74" />
                </linearGradient>
              </defs>
              {edgePaths.map((e, i) => {
                const grad =
                  e.kind === "parent"
                    ? "url(#treeStrokeParent)"
                    : e.kind === "spouse"
                      ? "url(#treeStrokeSpouse)"
                      : "url(#treeStrokeSibling)";
                const au = activeUnitIds;
                const endActive = au && au.has(e.from) && au.has(e.to);
                const dimEdge = Boolean(branchFocus && au && !endActive);
                const hotEdge = Boolean(branchFocus && au && endActive);
                return (
                  <g key={i} className={cn(dimEdge && "tree-dim", hotEdge && "tree-edge--focus")}>
                    <path d={e.d} className={`tree-edge-bg tree-ebg-${e.kind}`} filter="url(#treeSvgGlow)" />
                    <path d={e.d} className={`tree-edge tree-e-${e.kind}`} stroke={grad} />
                  </g>
                );
              })}
            </svg>

            {g.units.map((u, idx) => {
              const p = pos[u.unitId];
              if (!p) return null;
              const ps = u.persons;
              return (
                <div
                  key={u.unitId}
                  className={`tree-node${u.virtual ? " tree-node--virt" : ""}${ready ? " tree-node--enter" : ""}${branchFocus && !activeUnitIds.has(u.unitId) ? " tree-dim" : ""}`}
                  style={{
                    left: p.x,
                    top: p.y,
                    "--tree-enter-delay": `${idx * 0.06}s`,
                  }}
                  onMouseDown={(e) => onNodeDown(e, u.unitId)}
                >
                  {ps.length === 2 ? <div className="tree-pair-label">❤</div> : null}
                  <div className="tree-chips">
                    {ps.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        className={`tree-chip ${sx(person)}${person.isSelf ? " self" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressNextClickRef.current) {
                            suppressNextClickRef.current = false;
                            return;
                          }
                          if (nodeDrag.current?.active) return;
                          setPersonMenu({ clientX: e.clientX, clientY: e.clientY, person });
                        }}
                      >
                        <Av p={person} size={48} />
                        <div className="tree-chip-text">
                          <div className="tree-chip-name">{fmtName(person)}</div>
                          <div className="tree-chip-sub">
                            {person.isSelf
                              ? "Вы"
                              : safeText(person.birthDate) || safeText(person.birthCity) || ""}
                          </div>
                          <div className="tree-chip-sub">{safeText(person.middleName) || (person.sex === "M" ? "муж." : person.sex === "F" ? "жен." : "пол не указан")}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {loading ? (
            <div className="tree-loading" aria-busy="true" aria-live="polite">
              <Skeleton className="h-8 w-8 rounded-full" />
              <span>Загрузка…</span>
            </div>
          ) : null}
        </div>

        {g.unplaced.length > 0 ? (
          <Card className="tree-unplaced">
            <CardHeader>
              <CardTitle className="tree-unplaced-title">Не размещены ({g.unplaced.length})</CardTitle>
            </CardHeader>
            <div className="tree-unplaced-list">
              {g.unplaced.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="tree-unplaced-item"
                  onClick={(e) => {
                    const f = focusForClick(
                      data.mePersonId,
                      p.id,
                      parentMaps.fatherOf,
                      parentMaps.motherOf,
                    );
                    setBranchFocus(f);
                    setPersonMenu({ clientX: e.clientX, clientY: e.clientY, person: p });
                  }}
                >
                  <Av p={p} size={22} />
                  {fmtName(p)}
                </Button>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <TreePersonPopup
        anchor={personMenu}
        onClose={() => setPersonMenu(null)}
        onOpenDetails={(p) => setCard(p)}
        onStartAddRelative={openAddRelativeFromTree}
        onBranchFocus={(f) => setBranchFocus(f)}
        onBeginRelationPicker={beginRelationPicker}
      />

      {card ? (
        <TreePersonCardOverlay
          card={card}
          onClose={() => setCard(null)}
          onStartAddRelative={openAddRelativeFromTree}
          onBeginRelationPicker={beginRelationPicker}
          virtualAddPreset={String(card.id || "").startsWith("v:") ? parseVirtualTreeNodeId(card.id) : null}
        />
      ) : null}

      <TreeAddRelativeRelationPicker
        open={Boolean(relationPicker?.basePersonId)}
        onOpenChange={(open) => {
          if (!open) setRelationPicker(null);
        }}
        basePersonId={relationPicker?.basePersonId ?? ""}
        onSelect={onRelationTypePicked}
      />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Как работать с древом</DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground space-y-4 pt-2 text-left text-sm">
                <section className="space-y-1">
                  <h3 className="text-foreground text-sm font-semibold">Полотно</h3>
                  <p>
                    Зажмите левую кнопку мыши на пустом месте и перетащите — сдвиг вида. Колёсико мыши — масштаб. Узлы
                    можно перетаскивать, чтобы развести карточки.
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="text-foreground text-sm font-semibold">Заглушки</h3>
                  <p>
                    Серые карточки «Отец (не заполнен)» и т.п. — это подсказки: здесь в древе может быть человек.
                    После того как вы добавите реального родственника с этой связью, заглушка исчезнет.
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="text-foreground text-sm font-semibold">Меню по клику на древе</h3>
                  <p>
                    Откроется карточка действий: подробная анкета, подсветка материнской или отцовской линии либо ветки к
                    предку, и добавление родственника через отдельное окно выбора типа связи. Базовый человек для мастера
                    берётся с древа; линия родства подставляется автоматически.
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="text-foreground text-sm font-semibold">Родственники и правки</h3>
                  <p>
                    Полный список карточек, фото и редактирование анкет — во вкладке «Родственники». Кнопка «К списку
                    родственников» в карточке на древе ведёт туда же.
                  </p>
                </section>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addRelativeOpen}
        onOpenChange={(o) => {
          setAddRelativeOpen(o);
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 pb-3 pt-5">
            <DialogTitle>Новый родственник</DialogTitle>
            <DialogDescription className="text-left">
              Базовый человек задан из древа. Укажите тип связи на первом шаге (при необходимости) и заполните анкету —
              карточка появится на древе после сохранения.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
            {addRelativeOpen ? (
              <AddRelativeStepperForm
                key={addRelSession.key}
                persons={data.people || []}
                self={selfPerson}
                treeAnchorMode
                initialBasePersonId={addRelSession.basePersonId}
                initialRelationType={addRelSession.relationType}
                initialLine={addRelSession.line}
                onCreated={() => {
                  setAddRelativeOpen(false);
                  void load();
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
