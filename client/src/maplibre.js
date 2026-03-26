import maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker?url";

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;
