import React, { useCallback, useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "../maplibre.js";
import { apiGet } from "../api.js";
const MAP_STYLE = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
      tileSize: 256,
      attribution: "&copy; CartoDB &copy; OpenStreetMap",
    },
  },
  layers: [{
    id: "base",
    type: "raster",
    source: "carto",
    paint: {
      "raster-brightness-max": 0.58,
      "raster-saturation": -0.22,
      "raster-contrast": 0.08,
    },
  }],
};

function fmtName(p) { return [p?.lastName, p?.firstName].filter(Boolean).join(" ") || "Без имени"; }
function fmtFull(p) { return [p?.lastName, p?.firstName, p?.middleName].filter(Boolean).join(" ") || "Без имени"; }
function ini(p) { return ((p?.firstName || "?")[0] + ((p?.lastName || "")[0] || "")).toUpperCase().slice(0, 2); }
function sx(p) { return p?.sex === "M" ? "m" : p?.sex === "F" ? "f" : "u"; }

function groupByCity(markers) {
  const m = new Map();
  for (const mk of markers || []) {
    const c = (mk.label || "").trim();
    if (!c) continue;
    const lat = +mk.lat, lon = +mk.lon;
    if (!isFinite(lat) || !isFinite(lon)) continue;
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(mk);
  }
  return m;
}

function shortCity(name) {
  const s = (name || "").trim();
  if (s.length <= 16) return s;
  return `${s.slice(0, 14)}…`;
}

export default function MapPage() {
  const [filter, setFilter] = useState("birth");
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null);
  const [card, setCard] = useState(null);

  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const popRef = useRef(null);
  const domMarkersRef = useRef([]);
  const groupsRef = useRef(new Map());
  const mkRef = useRef([]);
  const mapReady = useRef(false);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fitBoundsIfNeeded = useCallback(() => {
    const mp = mapRef.current;
    if (!mp || !mapReady.current || markers.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const mk of markers) {
      const lat = +mk.lat;
      const lon = +mk.lon;
      if (Number.isFinite(lat) && Number.isFinite(lon)) bounds.extend([lon, lat]);
    }
    if (bounds.isEmpty()) return;
    try {
      mp.fitBounds(bounds, { padding: { top: 88, bottom: 72, left: 72, right: 56 }, maxZoom: 11, duration: 700 });
    } catch { /* ignore */ }
  }, [markers]);

  const fitBoundsRef = useRef(fitBoundsIfNeeded);
  fitBoundsRef.current = fitBoundsIfNeeded;

  function killPop() { try { popRef.current?.remove(); } catch {} popRef.current = null; }

  function showPop(map, ll, html) {
    if (!popRef.current) {
      popRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        maxWidth: "280px",
        className: "gm-pop",
      });
    }
    popRef.current.setLngLat(ll).setHTML(html).addTo(map);
  }

  const clearDomMarkers = useCallback(() => {
    for (const m of domMarkersRef.current) {
      try { m.remove(); } catch {}
    }
    domMarkersRef.current = [];
  }, []);

  const renderDomMarkers = useCallback(() => {
    const mp = mapRef.current;
    if (!mp || !mapReady.current) return;

    clearDomMarkers();

    for (const [city, arr] of groupsRef.current) {
      const { lat, lon } = arr[0];
      const ll = [+lon, +lat];

      if (arr.length > 1) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `gm-pin gm-pin--cluster gm-pin--mode-${filterRef.current}`;
        el.innerHTML = `
          <span class="gm-pin-cluster-glow" aria-hidden="true"></span>
          <span class="gm-pin-cluster-body">
            <span class="gm-pin-cluster-count">${arr.length}</span>
            <span class="gm-pin-cluster-city">${shortCity(city)}</span>
          </span>
          <span class="gm-pin-point" aria-hidden="true"></span>`;
        el.title = `${city}: ${arr.length} чел.`;
        el.addEventListener("mouseenter", () => {
          showPop(mp, ll, `<div class="gm-pop-inner"><strong>${city}</strong><div class="gm-pop-meta">${arr.length} человек в этой точке</div></div>`);
        });
        el.addEventListener("mouseleave", () => killPop());
        el.addEventListener("click", () => {
          setPanel({ city, items: arr.map(x => x.person).filter(Boolean) });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(ll).addTo(mp);
        domMarkersRef.current.push(marker);
      } else {
        const p = arr[0].person || {};
        const el = document.createElement("button");
        el.type = "button";
        el.className = `gm-pin gm-pin--person gm-pin--${sx(p)} gm-pin--mode-${filterRef.current}`;
        el.innerHTML = `
          <span class="gm-pin-ring" aria-hidden="true"></span>
          <span class="gm-pin-face">${ini(p)}</span>
          <span class="gm-pin-point" aria-hidden="true"></span>`;
        el.title = `${fmtName(p)} (${city})`;
        el.addEventListener("mouseenter", () => {
          const sub = [p.birthDate ? `р. ${p.birthDate}` : "", city].filter(Boolean).join(" · ");
          showPop(mp, ll, `<div class="gm-pop-inner"><strong>${fmtName(p)}</strong>${sub ? `<div class="gm-pop-meta">${sub}</div>` : ""}</div>`);
        });
        el.addEventListener("mouseleave", () => killPop());
        el.addEventListener("click", () => setCard(p));

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(ll).addTo(mp);
        domMarkersRef.current.push(marker);
      }
    }
  }, [clearDomMarkers]);

  async function load(f) {
    setLoading(true); setError(""); setPanel(null);
    try {
      const d = await apiGet(`/api/map?filter=${f}`);
      setMarkers(d.markers || []);
    } catch (e) { setError(e.message || "Ошибка"); setMarkers([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(filter); }, [filter]);

  useEffect(() => {
    mkRef.current = markers;
    const g = groupByCity(markers);
    groupsRef.current = g;
    renderDomMarkers();
    fitBoundsIfNeeded();
  }, [markers, renderDomMarkers, fitBoundsIfNeeded]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || mapRef.current) return;

    const mp = new maplibregl.Map({
      container: el,
      style: MAP_STYLE,
      center: [50, 55],
      zoom: 3.5,
      attributionControl: false,
    });
    mapRef.current = mp;
    mp.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    mp.on("load", () => {
      mapReady.current = true;
      renderDomMarkers();
      fitBoundsRef.current();
    });

    return () => {
      mapReady.current = false;
      clearDomMarkers();
      killPop();
      try { mp.remove(); } catch {}
      mapRef.current = null;
    };
  }, [clearDomMarkers, renderDomMarkers]);

  const cities = new Set((markers || []).map(x => x.label)).size;

  return (
    <>
      <div className={`gm-page gm-page--${filter}`}>
        <div className="gm-top">
          <div className="gm-head">
            <h2 className="gm-title">Карта семьи</h2>
            <p className="gm-sub">Точки по городам из справочника — клик по маркеру открывает список или карточку</p>
          </div>
          <div className="gm-filters">
            <button type="button" className={`gm-fbtn${filter === "birth" ? " on" : ""}`} onClick={() => setFilter("birth")}>
              <span className="gm-fbtn-ic" aria-hidden>◎</span>
              Рождение
            </button>
            <button type="button" className={`gm-fbtn${filter === "burial" ? " on" : ""}`} onClick={() => setFilter("burial")}>
              <span className="gm-fbtn-ic" aria-hidden>◇</span>
              Захоронение
            </button>
          </div>
          {!loading && markers.length > 0 && (
            <div className="gm-stats">
              <span className="gm-stat-pill">{markers.length} чел.</span>
              <span className="gm-stat-pill">{cities} {cities === 1 ? "город" : "городов"}</span>
            </div>
          )}
        </div>

        {error && <div className="gm-err">{error}</div>}

        <div className="gm-wrap">
          <div ref={boxRef} className="gm-box" />

          {loading && <div className="gm-overlay"><div className="gm-spin" />Загрузка...</div>}

          {!loading && !error && markers.length === 0 && (
            <div className="gm-overlay">
              <div style={{fontSize:28,marginBottom:6}}>📍</div>
              <div style={{fontWeight:700}}>Нет данных</div>
              <div className="gm-hint">Добавьте родственников с указанием {filter === "birth" ? "места рождения" : "места захоронения"}</div>
            </div>
          )}

          {panel && (
            <div className="gm-panel">
              <div className="gm-panel-accent" aria-hidden />
              <div className="gm-panel-head">
                <div>
                  <div className="gm-panel-kicker">Город</div>
                  <div className="gm-panel-city">{panel.city}</div>
                  <div className="gm-panel-cnt">{panel.items.length} {panel.items.length === 1 ? "человек" : "человек"}</div>
                </div>
                <button type="button" className="gm-panel-x" onClick={() => setPanel(null)} aria-label="Закрыть">✕</button>
              </div>
              <div className="gm-panel-list">
                {panel.items.map((p, i) => (
                  <button type="button" key={p.id || i} className="gm-person" onClick={() => setCard(p)}>
                    <div className={`gm-av ${sx(p)}`}>{ini(p)}</div>
                    <div className="gm-person-info">
                      <div className="gm-person-name">{fmtName(p)}</div>
                      <div className="gm-person-sub">{p.birthDate ? `р. ${p.birthDate}` : ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {card && (
        <div className="mc-overlay" onClick={() => setCard(null)}>
          <div className="mc-card" onClick={e => e.stopPropagation()}>
            <button className="mc-x" onClick={() => setCard(null)}>✕</button>
            <div className="mc-photo">
              <div className={`gm-av-lg ${sx(card)}`}>{ini(card)}</div>
              <div className="mc-name">{fmtFull(card)}</div>
              <div className="mc-meta">
                {card.sex === "M" ? "Мужской" : card.sex === "F" ? "Женский" : "Не указан"}
                {card.birthDate ? ` · р. ${card.birthDate}` : ""}
              </div>
            </div>
            <div className="mc-body">
              <Rv l="Место рождения" v={card.birthCityCustom || card.birthCity} />
              <Rv l="Телефон" v={card.phone} />
              <Rv l="Статус" v={card.alive ? "Жив(а)" : "Умер(ла)"} hl={!card.alive} />
              {!card.alive && <><Rv l="Дата смерти" v={card.deathDate} /><Rv l="Место захоронения" v={card.burialPlace} /></>}
              {card.notes && <Rv l="Заметки" v={card.notes} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Rv({ l, v, hl }) {
  return <div className={`mc-row${hl ? " hl" : ""}`}><div className="mc-label">{l}</div><div className="mc-val">{v || "—"}</div></div>;
}
