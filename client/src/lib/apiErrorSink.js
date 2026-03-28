/** Регистрируется из ApiErrorDialog: показ модального окна с текстом ошибки API. */
let handler = null;

export function registerApiErrorHandler(fn) {
  handler = typeof fn === "function" ? fn : null;
}

/** Показать ошибку в глобальном диалоге (shadcn Dialog). */
export function showApiError(message) {
  const text = String(message || "").trim() || "Произошла ошибка.";
  if (handler) {
    handler(text);
  } else {
    console.error("[api]", text);
  }
}

/** Для каких HTTP-кодов показываем глобальный диалог (остальное — только throw). */
export function shouldShowGlobalErrorDialog(status) {
  if (status === 401) return false;
  if (status === 400 || status === 403 || status === 404 || status === 409) return true;
  if (status >= 500) return true;
  return false;
}
