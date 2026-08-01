const DAY_MS = 24 * 60 * 60 * 1000;

export const toValidUnixDate = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const toLocalCalendarDayOrdinal = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
  );
};

export const differenceInLocalCalendarDays = (laterValue, earlierValue) => {
  const later = toLocalCalendarDayOrdinal(laterValue);
  const earlier = toLocalCalendarDayOrdinal(earlierValue);
  return later === null || earlier === null ? null : later - earlier;
};
