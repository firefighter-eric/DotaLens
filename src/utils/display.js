import { formatUnixDateTime, toValidUnixDate } from './date.js';

export const toFiniteOrNull = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const formatMatchDate = (startTime, lang) => {
  const date = toValidUnixDate(startTime);
  if (!date) {
    return '';
  }

  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const formatIntegerDisplay = (value, lang, fallback) => {
  const number = toFiniteOrNull(value);
  if (number === null) {
    return fallback;
  }
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  return new Intl.NumberFormat(locale).format(Math.round(number));
};

export const formatMatchDateTime = (startTime, lang, fallback) => formatUnixDateTime(startTime, lang === 'en' ? 'en-US' : 'zh-CN', fallback);

export const formatEntryValue = (value, fallback) => {
  const number = toFiniteOrNull(value);
  return number === null ? fallback : String(Math.round(number));
};

export const getAvatarInitial = (value, fallback = '?') => {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }
  return text.slice(0, 1).toUpperCase();
};
