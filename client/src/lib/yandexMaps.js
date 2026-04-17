/** Динамическая загрузка JavaScript API Яндекс.Карт 2.1 (singleton). */

let scriptPromise = null;

export function getYandexMapsApiKey() {
  const k = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
  return typeof k === "string" && k.trim().length > 0 ? k.trim() : "";
}

/**
 * @returns {Promise<typeof window.ymaps>}
 */
export function loadYmaps() {
  const key = getYandexMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("VITE_YANDEX_MAPS_API_KEY is not set"));
  }

  if (typeof window !== "undefined" && window.ymaps) {
    return new Promise((resolve, reject) => {
      window.ymaps.ready(() => resolve(window.ymaps), reject);
    });
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.onload = () => {
      if (!window.ymaps) {
        scriptPromise = null;
        reject(new Error("ymaps is missing after script load"));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps), (e) => {
        scriptPromise = null;
        reject(e || new Error("ymaps.ready failed"));
      });
    };
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Yandex Maps script"));
    };
    document.head.appendChild(s);
  });

  return scriptPromise;
}
