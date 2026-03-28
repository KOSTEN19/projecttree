import React, { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleDot, LandPlot, MapPin, X, AlertCircle } from "lucide-react";
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

function markerRadiusForCount(count) {
  const c = Math.max(1, Number(count) || 1);
  if (c <= 1) return 9;
  if (c <= 2) return 12;
  if (c <= 5) return 16;
  if (c <= 10) return 20;
  return 22;
}

export default function MapPage() {
  const [filter, setFilter] = useState("birth");
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null);
  const [panelPerson, setPanelPerson] = useState(null);
  const [leafletMap, setLeafletMap] = useState(null);

  const boxRef = useRef(null);
  const geoLayerRef = useRef(null);
  const groupsRef = useRef(new Map());
  const markersCacheRef = useRef({ birth: null, burial: null });
  const hoverPopupRef = useRef(null);

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

  const openByFeature = useCallback((feature) => {
    const city = feature?.properties?.city;
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
  }, []);

  const fitBoundsIfNeeded = useCallback((map) => {
    if (!map || markers.length === 0) return;
    const b = L.latLngBounds([]);
    let any = false;
    for (const mk of markers) {
      const lat = +mk.lat;
      const lon = +mk.lon;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        b.extend([lat, lon]);
        any = true;
      }
    }
    if (!any || !b.isValid()) return;
    try {
      map.fitBounds(b, { padding: [88, 88], maxZoom: 11, animate: true });
    } catch { /* ignore */ }
  }, [markers]);

  const rebuildGeoLayer = useCallback(
    (map) => {
      if (!map) return;
      if (geoLayerRef.current) {
        map.removeLayer(geoLayerRef.current);
        geoLayerRef.current = null;
      }
      try {
        map.closePopup();
      } catch { /* ignore */ }
      hoverPopupRef.current = null;

      const fc = getCityFeatureCollection();
      if (!fc.features.length) {
        if (geoLayerRef.current) {
          map.removeLayer(geoLayerRef.current);
          geoLayerRef.current = null;
        }
        return;
      }

      const layer = L.geoJSON(fc, {
        pointToLayer(feature, latlng) {
          const count = Number(feature.properties?.count || 1);
          const r = markerRadiusForCount(count);
          const fill = count > 1 ? "#8fb2df" : "#d59aaa";
          return L.circleMarker(latlng, {
            radius: r,
            fillColor: fill,
            color: "#6c5a4a",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          });
        },
        onEachFeature(feature, lay) {
          const city = feature.properties?.city;
          const count = Number(feature.properties?.count || 0);
          const short = feature.properties?.cityShort || city;
          const arr = groupsRef.current.get(city) || [];
          const p = arr[0]?.person || {};
          const sub = [p.birthDate ? `р. ${p.birthDate}` : "", city].filter(Boolean).join(" · ");

          const tipText = count > 1 ? `${count} · ${short}` : short;
          lay.bindTooltip(tipText, {
            permanent: true,
            direction: "bottom",
            offset: [0, 6],
            className: "map-leaflet-city-tip",
            opacity: 1,
          });

          lay.on("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            openByFeature(feature);
          });

          lay.on("mouseover", () => {
            lay.setStyle({ weight: 3, color: "#4a3c32" });
            const html =
              count > 1
                ? `<div class="gm-pop-inner"><strong>${city}</strong><div class="gm-pop-meta">${count} человек в этой точке</div></div>`
                : `<div class="gm-pop-inner"><strong>${fmtName(p)}</strong>${sub ? `<div class="gm-pop-meta">${sub}</div>` : ""}</div>`;
            const ll = lay.getLatLng();
            const pop = L.popup({
              className: "map-fam-popup",
              closeButton: false,
              autoPan: false,
              offset: L.point(0, -12),
            })
              .setLatLng(ll)
              .setContent(html);
            pop.openOn(map);
            hoverPopupRef.current = pop;
          });

          lay.on("mouseout", () => {
            lay.setStyle({ weight: 2, color: "#6c5a4a" });
            try {
              map.closePopup();
            } catch { /* ignore */ }
            hoverPopupRef.current = null;
          });
        },
      }).addTo(map);

      geoLayerRef.current = layer;
    },
    [getCityFeatureCollection, openByFeature]
  );

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;

    let disposed = false;
    let map = null;
    const ro = new ResizeObserver(() => {
      if (disposed) return;
      if (!map) tryInit();
      else map.invalidateSize({ animate: false });
    });

    function tryInit() {
      if (disposed || map) return;
      if (el.clientWidth < 8 || el.clientHeight < 8) return;

      map = L.map(el, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView([55.75, 37.6], 5);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.whenReady(() => {
        if (disposed) return;
        requestAnimationFrame(() => {
          map.invalidateSize({ animate: false });
          setLeafletMap(map);
        });
      });
    }

    ro.observe(el);
    tryInit();

    return () => {
      disposed = true;
      setLeafletMap(null);
      try {
        geoLayerRef.current = null;
        map?.remove();
      } catch { /* ignore */ }
      map = null;
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    groupsRef.current = groupByCity(markers);
    if (!leafletMap) return;
    rebuildGeoLayer(leafletMap);
    fitBoundsIfNeeded(leafletMap);
  }, [markers, filter, leafletMap, rebuildGeoLayer, fitBoundsIfNeeded]);

  useEffect(() => {
    leafletMap?.invalidateSize({ animate: false });
  }, [panel, filter, leafletMap]);

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
          <div ref={boxRef} className="map-canvas" role="presentation" />

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
                "z-[400] gap-0 py-0 shadow-lg ring-1 ring-border/80",
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
