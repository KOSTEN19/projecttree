import React, { useCallback, useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "../maplibre.js";
import { apiGet } from "../api.js";
const CITY_SOURCE_ID = "city-points";
const CITY_CIRCLE_LAYER_ID = "city-circles";
const CITY_LABEL_LAYER_ID = "city-labels";
const CITY_COUNT_LAYER_ID = "city-count";

function getMapStyle() {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "base",
        type: "raster",
        source: "osm",
        paint: {
          "raster-brightness-min": 0.34,
          "raster-brightness-max": 1.24,
          "raster-saturation": 0.08,
          "raster-contrast": 0.16,
        },
      },
    ],
  };
}

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

function normalizeLon(lon) {
  if (!Number.isFinite(lon)) return lon;
  let normalized = lon;
  while (normalized < -180) normalized += 360;
  while (normalized >= 180) normalized -= 360;
  return normalized;
}

export default function MapPage() {
  const [filter, setFilter] = useState("birth");
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null);
  const [panelPerson, setPanelPerson] = useState(null);

  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const popRef = useRef(null);
  const groupsRef = useRef(new Map());
  const markersCacheRef = useRef({ birth: null, burial: null });
  const mapReady = useRef(false);
  const mapHandlersBound = useRef(false);

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

  const getCityFeatureCollection = useCallback(() => {
    const features = [];
    for (const [city, arr] of groupsRef.current.entries()) {
      if (!arr?.length) continue;
      const lat = +arr[0].lat;
      const lon = normalizeLon(+arr[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const p = arr[0]?.person || {};
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {
          city,
          count: arr.length,
          initials: ini(p),
          personName: fmtName(p),
          cityShort: shortCity(city),
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, []);

  const ensureLayers = useCallback(() => {
    const mp = mapRef.current;
    if (!mp || !mapReady.current) return;
    if (!mp.getSource(CITY_SOURCE_ID)) {
      mp.addSource(CITY_SOURCE_ID, {
        type: "geojson",
        data: getCityFeatureCollection(),
      });
    }
    if (!mp.getLayer(CITY_CIRCLE_LAYER_ID)) {
      mp.addLayer({
        id: CITY_CIRCLE_LAYER_ID,
        type: "circle",
        source: CITY_SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 8, 2, 12, 5, 18, 10, 22],
          "circle-color": ["case", [">", ["get", "count"], 1], "#8fb2df", "#d59aaa"],
          "circle-stroke-width": 2.2,
          "circle-stroke-color": "#6c5a4a",
          "circle-opacity": 0.9,
        },
      });
    }
    if (!mp.getLayer(CITY_COUNT_LAYER_ID)) {
      mp.addLayer({
        id: CITY_COUNT_LAYER_ID,
        type: "symbol",
        source: CITY_SOURCE_ID,
        layout: {
          "text-field": ["case", [">", ["get", "count"], 1], ["to-string", ["get", "count"]], ""],
          "text-font": ["Open Sans Bold"],
          "text-size": 11,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#3b2f24",
        },
      });
    }
    if (!mp.getLayer(CITY_LABEL_LAYER_ID)) {
      mp.addLayer({
        id: CITY_LABEL_LAYER_ID,
        type: "symbol",
        source: CITY_SOURCE_ID,
        layout: {
          "text-field": ["get", "cityShort"],
          "text-font": ["Open Sans Semibold"],
          "text-size": 12,
          "text-offset": [0, 1.35],
          "text-anchor": "top",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#3b2f24",
          "text-halo-color": "rgba(252, 249, 243, 0.98)",
          "text-halo-width": 1.5,
        },
      });
    }
    if (!mapHandlersBound.current) {
      const openByFeature = (f) => {
        const city = f?.properties?.city;
        if (!city) return;
        const arr = groupsRef.current.get(city) || [];
        if (arr.length > 1) {
          setPanel({ city, items: arr.map((x) => x.person).filter(Boolean) });
          setPanelPerson(null);
          return;
        }
        const p = arr[0]?.person;
        if (p) {
          setPanel({ city, items: [p] });
          setPanelPerson(p);
        }
      };
      mp.on("click", CITY_CIRCLE_LAYER_ID, (e) => {
        const f = e?.features?.[0];
        openByFeature(f);
      });
      mp.on("mouseenter", CITY_CIRCLE_LAYER_ID, (e) => {
        mp.getCanvas().style.cursor = "pointer";
        const f = e?.features?.[0];
        if (!f) return;
        const city = f.properties?.city;
        const count = Number(f.properties?.count || 0);
        const ll = f.geometry?.coordinates;
        if (!city || !Array.isArray(ll)) return;
        if (count > 1) {
          showPop(
            mp,
            ll,
            `<div class="gm-pop-inner"><strong>${city}</strong><div class="gm-pop-meta">${count} человек в этой точке</div></div>`
          );
          return;
        }
        const arr = groupsRef.current.get(city) || [];
        const p = arr[0]?.person || {};
        const sub = [p.birthDate ? `р. ${p.birthDate}` : "", city].filter(Boolean).join(" · ");
        showPop(
          mp,
          ll,
          `<div class="gm-pop-inner"><strong>${fmtName(p)}</strong>${sub ? `<div class="gm-pop-meta">${sub}</div>` : ""}</div>`
        );
      });
      mp.on("mouseleave", CITY_CIRCLE_LAYER_ID, () => {
        mp.getCanvas().style.cursor = "";
        killPop();
      });
      mapHandlersBound.current = true;
    }
  }, [getCityFeatureCollection]);

  const refreshSourceData = useCallback(() => {
    const mp = mapRef.current;
    if (!mp || !mapReady.current) return;
    const src = mp.getSource(CITY_SOURCE_ID);
    if (src && typeof src.setData === "function") {
      src.setData(getCityFeatureCollection());
    }
  }, [getCityFeatureCollection]);

  async function load(f, opts = {}) {
    const { useCache = true } = opts;
    setLoading(true); setError(""); setPanel(null); setPanelPerson(null);
    if (useCache && markersCacheRef.current[f]) {
      setMarkers(markersCacheRef.current[f]);
      setLoading(false);
      return;
    }
    try {
      const timeoutMs = 9000;
      const d = await Promise.race([
        apiGet(`/api/map?filter=${f}`),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
      ]);
      const next = d?.markers || [];
      markersCacheRef.current[f] = next;
      setMarkers(next);
    } catch (e) {
      const cached = markersCacheRef.current[f];
      if (cached) {
        setMarkers(cached);
        setError("Данные карты обновляются медленно. Показан последний сохраненный слой.");
      } else {
        setError(e.message === "timeout" ? "Карта загружается слишком долго. Повторите попытку." : (e.message || "Ошибка"));
        setMarkers([]);
      }
    }
    finally { setLoading(false); }
  }

  useEffect(() => { load(filter, { useCache: true }); }, [filter]);

  useEffect(() => {
    const g = groupByCity(markers);
    groupsRef.current = g;
    refreshSourceData();
    fitBoundsIfNeeded();
  }, [markers, refreshSourceData, fitBoundsIfNeeded]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || mapRef.current) return;

    const mp = new maplibregl.Map({
      container: el,
      style: getMapStyle(),
      center: [50, 55],
      zoom: 3.5,
      attributionControl: false,
    });
    mapRef.current = mp;
    mp.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    mp.on("load", () => {
      mapReady.current = true;
      ensureLayers();
      refreshSourceData();
      fitBoundsRef.current();
    });

    return () => {
      mapReady.current = false;
      mapHandlersBound.current = false;
      killPop();
      try { mp.remove(); } catch {}
      mapRef.current = null;
    };
  }, [ensureLayers, refreshSourceData]);

  useEffect(() => {
    const mp = mapRef.current;
    const el = boxRef.current;
    if (!mp || !el) return;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        mp.resize();
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mp = mapRef.current;
    if (!mp || !mapReady.current) return;
    mp.resize();
  }, [panel, filter]);

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
                <button
                  type="button"
                  className="gm-panel-x"
                  onClick={() => {
                    setPanel(null);
                    setPanelPerson(null);
                  }}
                  aria-label="Закрыть"
                >
                  ✕
                </button>
              </div>
              <div className="gm-panel-list">
                {panel.items.map((p, i) => (
                  <button type="button" key={p.id || i} className="gm-person" onClick={() => setPanelPerson(p)}>
                    <div className={`gm-av ${sx(p)}`}>{ini(p)}</div>
                    <div className="gm-person-info">
                      <div className="gm-person-name">{fmtName(p)}</div>
                      <div className="gm-person-sub">{p.birthDate ? `р. ${p.birthDate}` : ""}</div>
                    </div>
                  </button>
                ))}
              </div>
              {panelPerson ? (
                <div className="gm-panel-head" style={{ borderTop: "1px solid var(--border)", marginTop: 8 }}>
                  <div>
                    <div className="gm-panel-kicker">Карточка</div>
                    <div className="gm-panel-city">{fmtFull(panelPerson)}</div>
                    <div className="gm-panel-cnt">
                      {(panelPerson.sex === "M" ? "Мужской" : panelPerson.sex === "F" ? "Женский" : "Не указан")}
                      {panelPerson.birthDate ? ` · р. ${panelPerson.birthDate}` : ""}
                    </div>
                    <div className="gm-panel-cnt">Место рождения: {panelPerson.birthCityCustom || panelPerson.birthCity || "—"}</div>
                    <div className="gm-panel-cnt">Статус: {panelPerson.alive ? "Жив(а)" : "Умер(ла)"}</div>
                    {!panelPerson.alive ? (
                      <>
                        <div className="gm-panel-cnt">Дата смерти: {panelPerson.deathDate || "—"}</div>
                        <div className="gm-panel-cnt">Место захоронения: {panelPerson.burialPlace || "—"}</div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
