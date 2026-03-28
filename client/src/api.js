import { shouldShowGlobalErrorDialog, showApiError } from "@/lib/apiErrorSink.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const ERROR_MESSAGES = {
  invalid_json: "Некорректный запрос.",
  not_authorized: "Требуется вход в систему.",
  not_found: "Данные не найдены.",
  server_error: "Ошибка сервера. Попробуйте позже.",
  bad_id: "Некорректный идентификатор.",
  bad_basePersonId: "Некорректная связь с родственником.",
  cannot_delete_self: "Нельзя удалить свой профиль.",
  validation_failed: "Проверьте введённые данные.",
};

function pickErrorMessage(data, status) {
  if (data && typeof data === "object" && typeof data.message === "string") {
    const m = data.message.trim();
    if (m) return m;
  }
  if (data && typeof data === "object" && typeof data.error === "string") {
    const code = data.error;
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    return code;
  }
  if (typeof data === "string" && data.trim()) return data.trim();
  if (status === 404) return "Не найдено.";
  return `HTTP ${status}`;
}

export function assetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export function saveToken(token) {
  localStorage.setItem("token", token);
}
export function clearToken() {
  localStorage.removeItem("token");
}
function getToken() {
  return localStorage.getItem("token") || "";
}

/**
 * @param {string} path
 * @param {RequestInit & { silentGlobalDialog?: boolean }} [options]
 */
async function request(path, options = {}) {
  const { silentGlobalDialog, ...fetchOptions } = options;
  const url = `${API_BASE}${path}`;
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers || {}),
  };

  const res = await fetch(url, { ...fetchOptions, headers });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
    }
    const msg = pickErrorMessage(data, res.status);
    if (!silentGlobalDialog && shouldShowGlobalErrorDialog(res.status)) {
      showApiError(msg);
    }
    throw new Error(msg);
  }

  return data;
}

export function apiGet(path, options) {
  return request(path, { method: "GET", ...options });
}

export function apiPost(path, body, options) {
  return request(path, { method: "POST", body: JSON.stringify(body || {}), ...options });
}

export function apiPut(path, body, options) {
  return request(path, { method: "PUT", body: JSON.stringify(body || {}), ...options });
}

export function apiDelete(path, options) {
  return request(path, { method: "DELETE", ...options });
}

export async function apiUploadPersonPhoto(personId, file) {
  const url = `${API_BASE}/api/persons/${personId}/photo`;
  const token = getToken();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401) clearToken();
    const msg = pickErrorMessage(data, res.status);
    if (shouldShowGlobalErrorDialog(res.status)) {
      showApiError(msg);
    }
    throw new Error(msg);
  }
  return data;
}
