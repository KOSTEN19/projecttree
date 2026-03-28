/** Допустимые символы телефона: цифры, + ( ) пробел . - */
export const PHONE_ALLOWED_PATTERN = "[0-9+()\\s.\\-]*";
export const PHONE_TITLE =
  "Только цифры и символы + ( ) - пробел. Не менее 10 цифр, если поле заполнено.";

export function sanitizePhoneInput(value) {
  return String(value || "").replace(/[^\d+()\s.\-]/g, "");
}

/** Клиентская проверка телефона (пусто OK). */
export function validatePhoneClient(phone) {
  const s = String(phone || "").trim();
  if (!s) return null;
  if (!/^[0-9+()\s.\-]+$/.test(s)) {
    return "Телефон может содержать только цифры и символы + ( ) - пробел.";
  }
  const digits = s.replace(/\D/g, "").length;
  if (digits < 10) return "Телефон: укажите не менее 10 цифр или оставьте поле пустым.";
  if (digits > 15) return "Телефон: слишком много цифр.";
  return null;
}

export function validateEmailOptional(email) {
  const s = String(email || "").trim();
  if (!s) return null;
  // Простая проверка; строгая — на сервере.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    return "Некорректный адрес электронной почты.";
  }
  return null;
}
