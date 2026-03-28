import React, { useCallback, useEffect, useRef, useState } from "react";
import { CircleDot, LandPlot, MapPin, X, AlertCircle } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "../maplibre.js";
import { apiGet } from "../api.js";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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

function avatarFallbackClass(p) {
  if (p?.sex === "M") return "bg-blue-600 text-white";
  if (p?.sex === "F") return "bg-pink-600 text-white";
  return "bg-violet-600 text-white";
}

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
      mp.fitBounds(bounds, { padding: { top: 140, bottom: 88, left: 72, right: 72 }, maxZoom: 11, duration: 700 });
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
    <div className="home-shell home-portal -mx-4 space-y-0 md:-mx-6">
      <div className={cn("map-page", filter === "burial" && "map-page--burial")}>
        <section className="home-portal-hero shrink-0 border-b border-border/60 px-4 py-6 md:px-6 md:py-8">
          <div className="home-portal-grid flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Badge variant="secondary" className="home-pill home-portal-kicker mb-2">
                География рода
              </Badge>
              <h2 className="home-portal-title text-2xl md:text-3xl">Карта семьи</h2>
              <p className="home-portal-subtitle mt-1 max-w-xl">
                Точки по городам из справочника — клик по маркеру открывает список или карточку
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={filter === "birth" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setFilter("birth")}
                >
                  <CircleDot className="size-3.5 opacity-80" aria-hidden />
                  Рождение
                </Button>
                <Button
                  type="button"
                  variant={filter === "burial" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setFilter("burial")}
                >
                  <LandPlot className="size-3.5 opacity-80" aria-hidden />
                  Захоронение
                </Button>
              </div>
              {!loading && markers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    {markers.length} чел.
                  </Badge>
                  <Badge variant="secondary" className="tabular-nums">
                    {cities} {cities === 1 ? "город" : "городов"}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </section>

        {error ? (
          <div className="shrink-0 px-4 pt-3 md:px-6">
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Карта</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="map-wrap">
          <div ref={boxRef} className="map-canvas" />

          {loading && (
            <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-background/75 backdrop-blur-[2px]">
              <Skeleton className="absolute inset-0 rounded-none opacity-40" />
              <span className="relative text-sm text-muted-foreground">Загрузка карты…</span>
            </div>
          )}

          {!loading && !error && markers.length === 0 && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center p-4">
              <Card className="max-w-sm shadow-md">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                    <MapPin className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <CardTitle>Нет данных</CardTitle>
                  <CardDescription>
                    Добавьте родственников с указанием{" "}
                    {filter === "birth" ? "места рождения" : "места захоронения"}.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

          {panel && (
            <Card
              className={cn(
                "z-40 gap-0 py-0 shadow-lg ring-1 ring-border/80",
                "md:absolute md:top-3 md:right-3 md:bottom-auto md:w-[min(300px,calc(100%-1.5rem))] md:max-h-[min(520px,calc(100%-1.5rem))]",
                "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[45vh] max-md:rounded-b-none max-md:rounded-t-xl max-md:border-b-0"
              )}
            >
              <div
                className={cn(
                  "h-1 w-full shrink-0 rounded-t-xl",
                  "bg-gradient-to-r from-chart-2 via-chart-1 to-chart-5",
                  filter === "burial" && "from-chart-4 via-chart-1 to-chart-5"
                )}
                aria-hidden
              />
              <CardHeader className="border-b border-border/60 pb-3">
                <CardDescription className="text-xs font-semibold tracking-widest uppercase">
                  Город
                </CardDescription>
                <CardTitle className="text-lg leading-tight">{panel.city}</CardTitle>
                <CardDescription>
                  {panel.items.length} {panel.items.length === 1 ? "человек" : "человек"}
                </CardDescription>
                <CardAction>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => {
                      setPanel(null);
                      setPanelPerson(null);
                    }}
                    aria-label="Закрыть"
                  >
                    <X className="size-4" />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="max-h-[min(40vh,280px)] overflow-y-auto pt-0 pb-3 md:max-h-[min(36vh,260px)]">
                <ul className="flex flex-col gap-1 p-0">
                  {panel.items.map((p, i) => (
                    <li key={p.id || i}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 py-2.5"
                        onClick={() => setPanelPerson(p)}
                      >
                        <Avatar size="sm" className="size-8">
                          <AvatarFallback className={cn("text-xs font-semibold", avatarFallbackClass(p))}>
                            {ini(p)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-medium">{fmtName(p)}</span>
                          {p.birthDate ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              р. {p.birthDate}
                            </span>
                          ) : null}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
              {panelPerson ? (
                <>
                  <Separator />
                  <CardHeader className="pt-3 pb-4">
                    <CardDescription className="text-xs font-semibold tracking-widest uppercase">
                      Карточка
                    </CardDescription>
                    <CardTitle className="text-base leading-snug">{fmtFull(panelPerson)}</CardTitle>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        {(panelPerson.sex === "M" ? "Мужской" : panelPerson.sex === "F" ? "Женский" : "Не указан")}
                        {panelPerson.birthDate ? ` · р. ${panelPerson.birthDate}` : ""}
                      </p>
                      <p>Место рождения: {panelPerson.birthCityCustom || panelPerson.birthCity || "—"}</p>
                      <p>Статус: {panelPerson.alive ? "Жив(а)" : "Умер(ла)"}</p>
                      {!panelPerson.alive ? (
                        <>
                          <p>Дата смерти: {panelPerson.deathDate || "—"}</p>
                          <p>Место захоронения: {panelPerson.burialPlace || "—"}</p>
                        </>
                      ) : null}
                    </div>
                  </CardHeader>
                </>
              ) : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
