import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleDot, LandPlot, MapPin, Maximize2, X, AlertCircle } from "lucide-react";
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

function subscribeDarkClass(cb) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function getDarkSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerDarkSnapshot() {
  return false;
}

function useDocumentDark() {
  return useSyncExternalStore(subscribeDarkClass, getDarkSnapshot, getServerDarkSnapshot);
}

const BASEMAP = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

function fmtName(p) {
  return [p?.lastName, p?.firstName].filter(Boolean).join(" ") || "Без имени";
}
function fmtFull(p) {
  return [p?.lastName, p?.firstName, p?.middleName].filter(Boolean).join(" ") || "Без имени";
}
function ini(p) {
  return ((p?.firstName || "?")[0] + ((p?.lastName || "")[0] || "")).toUpperCase().slice(0, 2);
}

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
    const lat = +mk.lat;
    const lon = +mk.lon;
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

function markerSizeForCount(count) {
  const c = Math.max(1, Number(count) || 1);
  if (c <= 1) return 44;
  if (c <= 3) return 48;
  if (c <= 8) return 52;
  return 56;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** DivIcon: маркер семьи, цвета из темы через data-атрибуты и CSS. */
function makeFamilyPinIcon({ count, initials, cityShort, kind }) {
  const multi = count > 1;
  const size = markerSizeForCount(count);
  const half = Math.round(size / 2);
  const anchorY = size - 4;
  const inner = multi
    ? `<div class="fam-pin fam-pin--cluster" data-kind="${kind}" role="img" aria-label="${count} человек, ${escapeHtml(cityShort)}"><span class="fam-pin__pulse" aria-hidden="true"></span><span class="fam-pin__ring" aria-hidden="true"></span><span class="fam-pin__core" aria-hidden="true"></span><span class="fam-pin__count">${count}</span></div>`
    : `<div class="fam-pin fam-pin--solo" data-kind="${kind}" role="img" aria-label="${escapeHtml(initials)}"><span class="fam-pin__pulse" aria-hidden="true"></span><span class="fam-pin__ring" aria-hidden="true"></span><span class="fam-pin__glyph">${escapeHtml(initials)}</span></div>`;

  return L.divIcon({
    className: "fam-pin-leaflet",
    html: inner,
    iconSize: [size, size],
    iconAnchor: [half, anchorY],
    popupAnchor: [0, -anchorY + 6],
  });
}

export default function MapPage() {
  const isDark = useDocumentDark();
  const [filter, setFilter] = useState("birth");
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null);
  const [panelPerson, setPanelPerson] = useState(null);
  const [leafletMap, setLeafletMap] = useState(null);

  const boxRef = useRef(null);
  const geoLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const groupsRef = useRef(new Map());
  const markersCacheRef = useRef({ birth: null, burial: null });
  const hoverPopupRef = useRef(null);
  const basemapKeyRef = useRef(null);

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

  const fitBoundsIfNeeded = useCallback(
    (map) => {
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
        map.fitBounds(b, { padding: [72, 72], maxZoom: 11, animate: true });
      } catch {
        /* ignore */
      }
    },
    [markers],
  );

  const rebuildGeoLayer = useCallback(
    (map) => {
      if (!map) return;
      if (geoLayerRef.current) {
        map.removeLayer(geoLayerRef.current);
        geoLayerRef.current = null;
      }
      try {
        map.closePopup();
      } catch {
        /* ignore */
      }
      hoverPopupRef.current = null;

      const fc = getCityFeatureCollection();
      if (!fc.features.length) return;

      const kind = filter === "burial" ? "burial" : "birth";

      const layer = L.geoJSON(fc, {
        pointToLayer(feature, latlng) {
          const count = Number(feature.properties?.count || 1);
          const icon = makeFamilyPinIcon({
            count,
            initials: feature.properties?.initials || "?",
            cityShort: feature.properties?.cityShort || "",
            kind,
          });
          return L.marker(latlng, { icon });
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
            offset: [0, 8],
            className: "fam-map-tooltip",
            opacity: 1,
          });

          lay.on("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            openByFeature(feature);
          });

          lay.on("mouseover", () => {
            lay.getElement()?.classList.add("fam-pin-marker--hover");
            const html =
              count > 1
                ? `<div class="gm-pop-inner"><strong>${escapeHtml(city)}</strong><div class="gm-pop-meta">${count} человек в этой точке</div></div>`
                : `<div class="gm-pop-inner"><strong>${escapeHtml(fmtName(p))}</strong>${sub ? `<div class="gm-pop-meta">${escapeHtml(sub)}</div>` : ""}</div>`;
            const ll = lay.getLatLng();
            const pop = L.popup({
              className: "map-fam-popup fam-map-hover-popup",
              closeButton: false,
              autoPan: false,
              offset: L.point(0, -14),
            })
              .setLatLng(ll)
              .setContent(html);
            pop.openOn(map);
            hoverPopupRef.current = pop;
          });

          lay.on("mouseout", () => {
            lay.getElement()?.classList.remove("fam-pin-marker--hover");
            try {
              map.closePopup();
            } catch {
              /* ignore */
            }
            hoverPopupRef.current = null;
          });
        },
      }).addTo(map);

      geoLayerRef.current = layer;
    },
    [getCityFeatureCollection, openByFeature, filter],
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
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView([55.75, 37.6], 5);

      if (map.attributionControl?.setPrefix) {
        map.attributionControl.setPrefix(false);
      }

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const dark = getDarkSnapshot();
      const spec = dark ? BASEMAP.dark : BASEMAP.light;
      basemapKeyRef.current = dark ? "dark" : "light";
      const tiles = L.tileLayer(spec.url, {
        attribution: spec.attribution,
        maxZoom: 20,
        subdomains: "abcd",
      });
      tiles.addTo(map);
      tileLayerRef.current = tiles;

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
        tileLayerRef.current = null;
        map?.remove();
      } catch {
        /* ignore */
      }
      map = null;
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!leafletMap || !tileLayerRef.current) return;
    const wantDark = isDark;
    const key = wantDark ? "dark" : "light";
    if (basemapKeyRef.current === key) return;
    basemapKeyRef.current = key;
    const spec = wantDark ? BASEMAP.dark : BASEMAP.light;
    leafletMap.removeLayer(tileLayerRef.current);
    const tiles = L.tileLayer(spec.url, {
      attribution: spec.attribution,
      maxZoom: 20,
      subdomains: "abcd",
    });
    tiles.addTo(leafletMap);
    tileLayerRef.current = tiles;
  }, [isDark, leafletMap]);

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
    setLoading(true);
    setError("");
    setPanel(null);
    setPanelPerson(null);
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
        setError("Данные карты обновляются медленно. Показан последний сохранённый слой.");
      } else {
        setError(
          e.message === "timeout" ? "Карта загружается слишком долго. Повторите попытку." : e.message || "Ошибка",
        );
        setMarkers([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter, { useCache: true });
  }, [filter]);

  const cities = new Set((markers || []).map((x) => x.label)).size;
  const kind = filter === "burial" ? "burial" : "birth";

  return (
    <div className="fam-map-page flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={cn("fam-map-stage relative min-h-0 flex-1", filter === "burial" && "fam-map-stage--burial")}>
        <div ref={boxRef} className="fam-map-canvas absolute inset-0 z-0" role="presentation" />

        <div className="fam-map-chrome pointer-events-none absolute inset-x-0 top-0 z-[400] flex flex-col gap-2 p-3 sm:p-4">
          <div className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="fam-map-chrome-panel max-w-md rounded-xl border border-border/70 bg-card/90 px-4 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur-md dark:bg-card/85 dark:ring-white/10">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-medium">
                  География рода
                </Badge>
                {isDark ? (
                  <span className="text-muted-foreground text-[0.65rem] uppercase tracking-wider">Тёмная карта</span>
                ) : (
                  <span className="text-muted-foreground text-[0.65rem] uppercase tracking-wider">Светлая карта</span>
                )}
              </div>
              <h1 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">Карта семьи</h1>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-snug">
                Точки по городам из справочника. Клик по маркеру — список или карточка. Цвет маркера подстраивается под
                тему интерфейса.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!leafletMap || markers.length === 0}
                  onClick={() => fitBoundsIfNeeded(leafletMap)}
                  title="Показать все точки"
                >
                  <Maximize2 className="size-3.5 opacity-80" aria-hidden />
                  Все точки
                </Button>
              </div>
              {!loading && markers.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="tabular-nums">
                    {markers.length} чел.
                  </Badge>
                  <Badge variant="outline" className="tabular-nums">
                    {cities} {cities === 1 ? "город" : "городов"}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="pointer-events-auto fam-map-legend hidden rounded-lg border border-border/60 bg-card/88 px-3 py-2 text-xs shadow-md backdrop-blur-md sm:block dark:bg-card/80">
              <div className="text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Условные обозначения</div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="fam-map-legend-sample fam-map-legend-sample--solo" data-kind={kind} aria-hidden />
                <span>Один человек в городе</span>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="fam-map-legend-sample fam-map-legend-sample--cluster" data-kind={kind} aria-hidden />
                <span>Несколько — число на маркере</span>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="pointer-events-auto absolute bottom-20 left-3 right-3 z-[410] sm:left-auto sm:right-4 sm:max-w-md">
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Карта</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        {loading && (
          <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-[2px]">
            <Skeleton className="absolute inset-0 rounded-none opacity-35" />
            <span className="relative text-sm text-muted-foreground">Загрузка карты…</span>
          </div>
        )}

        {!loading && !error && markers.length === 0 && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center p-4">
            <Card className="max-w-sm shadow-lg">
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
              "pointer-events-auto z-[420] gap-0 py-0 shadow-xl ring-1 ring-border/80",
              "md:absolute md:top-20 md:right-4 md:bottom-auto md:w-[min(320px,calc(100%-2rem))] md:max-h-[min(calc(100%-6rem),560px)]",
              "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[48vh] max-md:rounded-b-none max-md:rounded-t-xl max-md:border-b-0",
            )}
          >
            <div
              className={cn(
                "h-1 w-full shrink-0 rounded-t-xl",
                "bg-gradient-to-r from-chart-2 via-primary to-chart-5",
                filter === "burial" && "from-chart-4 via-chart-2 to-chart-5",
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
            <CardContent className="max-h-[min(42vh,300px)] overflow-y-auto pt-0 pb-3 md:max-h-[min(38vh,280px)]">
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
                          <span className="block truncate text-xs text-muted-foreground">р. {p.birthDate}</span>
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
                      {panelPerson.sex === "M" ? "Мужской" : panelPerson.sex === "F" ? "Женский" : "Не указан"}
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
  );
}
