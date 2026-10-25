import {
  commonAbsolutePresetKey,
  historyMode,
  relativeUnit,
  timeFilterTab,
  timePresetKey,
  type CommonAbsolutePresetKey,
  type CommonAbsolutePresetRange,
  type RelativeUnit,
  type RelativeTimePresetOption,
  type TimeFilterHistoryItem,
  type TimePresetKey,
  type TimePresetOption,
  type TimePrecision,
  type TimeRangeValue,
} from "@magic-admin-v2/components/time-filter-panel/types";

export const dateTimeFormat = "YYYY-MM-DD HH:mm:ss";
export const monthKeyFormat = "YYYY-MM";
export const timeFilterHistoryStorageKey = "magic_admin_time_filter_history:v1";
export const maxHistorySize = 10;

export const defaultSupportedRelativeUnits: readonly RelativeUnit[] = [
  relativeUnit.minute,
  relativeUnit.hour,
  relativeUnit.day,
];

const relativeUnitOrder: readonly RelativeUnit[] = [
  relativeUnit.second,
  relativeUnit.minute,
  relativeUnit.hour,
  relativeUnit.day,
];

const secondPresetOptions: RelativeTimePresetOption[] = [
  { amount: 1, key: timePresetKey.last_1_second, labelKey: "last1Second", unit: relativeUnit.second },
  { amount: 5, key: timePresetKey.last_5_seconds, labelKey: "last5Seconds", unit: relativeUnit.second },
  { amount: 10, key: timePresetKey.last_10_seconds, labelKey: "last10Seconds", unit: relativeUnit.second },
  { amount: 15, key: timePresetKey.last_15_seconds, labelKey: "last15Seconds", unit: relativeUnit.second },
  { amount: 30, key: timePresetKey.last_30_seconds, labelKey: "last30Seconds", unit: relativeUnit.second },
];

const minutePresetOptions: RelativeTimePresetOption[] = [
  { amount: 1, key: timePresetKey.last_1_minute, labelKey: "last1Minute", unit: relativeUnit.minute },
  { amount: 5, key: timePresetKey.last_5_minutes, labelKey: "last5Minutes", unit: relativeUnit.minute },
  { amount: 10, key: timePresetKey.last_10_minutes, labelKey: "last10Minutes", unit: relativeUnit.minute },
  { amount: 15, key: timePresetKey.last_15_minutes, labelKey: "last15Minutes", unit: relativeUnit.minute },
  { amount: 30, key: timePresetKey.last_30_minutes, labelKey: "last30Minutes", unit: relativeUnit.minute },
];

const hourPresetOptions: RelativeTimePresetOption[] = [
  { amount: 1, key: timePresetKey.last_1_hour, labelKey: "last1Hour", unit: relativeUnit.hour },
  { amount: 3, key: timePresetKey.last_3_hours, labelKey: "last3Hours", unit: relativeUnit.hour },
  { amount: 6, key: timePresetKey.last_6_hours, labelKey: "last6Hours", unit: relativeUnit.hour },
  { amount: 12, key: timePresetKey.last_12_hours, labelKey: "last12Hours", unit: relativeUnit.hour },
  { amount: 24, key: timePresetKey.last_24_hours, labelKey: "last24Hours", unit: relativeUnit.hour },
];

const defaultDayPresetOptions: RelativeTimePresetOption[] = [
  { amount: 1, key: timePresetKey.last_1_day, labelKey: "last1Day", unit: relativeUnit.day },
  { amount: 3, key: timePresetKey.last_3_days, labelKey: "last3Days", unit: relativeUnit.day },
  { amount: 7, key: timePresetKey.last_7_days, labelKey: "last7Days", unit: relativeUnit.day },
  { amount: 30, key: timePresetKey.last_30_days, labelKey: "last30Days", unit: relativeUnit.day },
  { amount: 90, key: timePresetKey.last_90_days, labelKey: "last90Days", unit: relativeUnit.day },
];

export const dayOnlyPresetOptions: RelativeTimePresetOption[] = [
  defaultDayPresetOptions[0],
  defaultDayPresetOptions[1],
  defaultDayPresetOptions[2],
  { amount: 14, key: timePresetKey.last_14_days, labelKey: "last14Days", unit: relativeUnit.day },
  { amount: 21, key: timePresetKey.last_21_days, labelKey: "last21Days", unit: relativeUnit.day },
  defaultDayPresetOptions[3],
  { amount: 60, key: timePresetKey.last_60_days, labelKey: "last60Days", unit: relativeUnit.day },
  defaultDayPresetOptions[4],
  { amount: 120, key: timePresetKey.last_120_days, labelKey: "last120Days", unit: relativeUnit.day },
  { amount: 180, key: timePresetKey.last_180_days, labelKey: "last180Days", unit: relativeUnit.day },
  { amount: 365, key: timePresetKey.last_365_days, labelKey: "last365Days", unit: relativeUnit.day },
];

const relativePresetOptionsByUnit: Record<RelativeUnit, RelativeTimePresetOption[]> = {
  [relativeUnit.second]: secondPresetOptions,
  [relativeUnit.minute]: minutePresetOptions,
  [relativeUnit.hour]: hourPresetOptions,
  [relativeUnit.day]: defaultDayPresetOptions,
};

export const quickPresetOptions: RelativeTimePresetOption[] = [
  ...secondPresetOptions,
  ...minutePresetOptions,
  ...hourPresetOptions,
  ...dayOnlyPresetOptions,
];

export function normalizeSupportedRelativeUnits(units: readonly RelativeUnit[]) {
  const unitSet = new Set(units);
  const normalized = relativeUnitOrder.filter((unit) => unitSet.has(unit));
  return normalized.length > 0 ? normalized : [...defaultSupportedRelativeUnits];
}

export function isDayOnlyRelativeUnits(units: readonly RelativeUnit[]) {
  return units.length === 1 && units[0] === relativeUnit.day;
}

export function getQuickPresetGroups(units: readonly RelativeUnit[]) {
  const dayOnly = isDayOnlyRelativeUnits(units);

  return units.map((unit) => ({
    key: unit,
    options: unit === relativeUnit.day && dayOnly
      ? dayOnlyPresetOptions
      : relativePresetOptionsByUnit[unit],
  }));
}

export function getRelativePresetOption(preset: TimePresetKey) {
  return quickPresetOptions.find((option) => option.key === preset);
}

export const standardPresetOptions: TimePresetOption[] = [
  { key: timePresetKey.today, labelKey: "today" },
  { key: timePresetKey.yesterday, labelKey: "yesterday" },
  { key: timePresetKey.day_before_yesterday, labelKey: "dayBeforeYesterday" },
  { key: timePresetKey.this_week, labelKey: "thisWeek" },
  { key: timePresetKey.last_week, labelKey: "lastWeek" },
  { key: timePresetKey.this_month, labelKey: "thisMonth" },
  { key: timePresetKey.last_month, labelKey: "lastMonth" },
  { key: timePresetKey.this_year, labelKey: "thisYear" },
];

export function formatDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function formatTimeRangeText(
  startDate: string,
  endDate: string,
  dayOnly = false,
) {
  const start = dayOnly ? startDate.slice(0, 10) : startDate;
  const end = dayOnly ? endDate.slice(0, 10) : endDate;

  return `${start} ~ ${end}`;
}

export function parseDateTime(value: string) {
  if (!value) {
    return null;
  }

  const normalized = value.replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateTimeInputValue(value: string) {
  return value ? value.slice(0, 16).replace(" ", "T") : "";
}

export function parseDateTimeInputValue(value: string) {
  return value ? `${value.replace("T", " ")}:00` : "";
}

export function normalizeAbsoluteDate(
  date: Date,
  precision: TimePrecision,
  boundary: "start" | "end",
) {
  const next = new Date(date);

  if (precision === "day") {
    return boundary === "start" ? startOf(next, "day") : endOf(next, "day");
  }

  if (precision === "hour") {
    next.setMinutes(boundary === "end" ? 59 : 0, boundary === "end" ? 59 : 0, 0);
    return next;
  }

  if (precision === "minute") {
    next.setSeconds(boundary === "end" ? 59 : 0, 0);
    return next;
  }

  next.setMilliseconds(0);
  return next;
}

export function formatTimeRangeByPrecision(
  startDate: string,
  endDate: string,
  precision: TimePrecision,
) {
  if (precision === "day") {
    return formatTimeRangeText(startDate, endDate, true);
  }

  if (precision === "hour") {
    return `${startDate.slice(0, 13)}:00 ~ ${endDate.slice(0, 13)}:59`;
  }

  if (precision === "minute") {
    return `${startDate.slice(0, 16)} ~ ${endDate.slice(0, 16)}`;
  }

  return formatTimeRangeText(startDate, endDate, false);
}

export function addDate(date: Date, amount: number, unit: RelativeUnit) {
  const next = new Date(date);

  if (unit === relativeUnit.second) {
    next.setSeconds(next.getSeconds() + amount);
    return next;
  }

  if (unit === relativeUnit.minute) {
    next.setMinutes(next.getMinutes() + amount);
    return next;
  }

  if (unit === relativeUnit.hour) {
    next.setHours(next.getHours() + amount);
    return next;
  }

  next.setDate(next.getDate() + amount);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOf(
  date: Date,
  unit: "day" | "hour" | "minute" | "month" | "second" | "year",
) {
  const next = new Date(date);

  if (unit === "year") {
    next.setMonth(0, 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  if (unit === "month") {
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  if (unit === "day") {
    next.setHours(0, 0, 0, 0);
    return next;
  }

  if (unit === "hour") {
    next.setMinutes(0, 0, 0);
    return next;
  }

  if (unit === "minute") {
    next.setSeconds(0, 0);
    return next;
  }

  if (unit === "second") {
    next.setMilliseconds(0);
    return next;
  }

  return next;
}

export function endOf(date: Date, unit: "day" | "month") {
  if (unit === "month") {
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    next.setHours(23, 59, 59, 999);
    return next;
  }

  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function compareDateOnly(left: Date, right: Date) {
  return startOf(left, "day").getTime() - startOf(right, "day").getTime();
}

export function getCalendarDays(month: Date) {
  const monthStart = startOf(month, "month");
  const monthEnd = endOf(month, "month");
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const calendarDays: Date[] = [];

  for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
    calendarDays.push(date);
  }

  return calendarDays;
}

export function isSameDate(left: Date | null, right: Date | null) {
  if (!left || !right) {
    return false;
  }

  return compareDateOnly(left, right) === 0;
}

export function isDateBetween(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) {
    return false;
  }

  const targetTime = startOf(date, "day").getTime();
  return targetTime > startOf(start, "day").getTime() && targetTime < startOf(end, "day").getTime();
}

export function alignTimeByUnit(date: Date, unit: RelativeUnit) {
  return startOf(date, unit);
}

function getStartOfWeek(date: Date) {
  const next = startOf(date, "day");
  const day = next.getDay();
  const diff = day === 0 ? 6 : day - 1;
  next.setDate(next.getDate() - diff);
  return next;
}

function getDayRangeByPreset(preset: TimePresetKey, now = new Date()): [Date, Date] {
  const end = endOf(now, "day");
  const dayAmounts: Partial<Record<TimePresetKey, number>> = {
    [timePresetKey.last_3_days]: 3,
    [timePresetKey.last_7_days]: 7,
    [timePresetKey.last_14_days]: 14,
    [timePresetKey.last_21_days]: 21,
    [timePresetKey.last_30_days]: 30,
    [timePresetKey.last_60_days]: 60,
    [timePresetKey.last_90_days]: 90,
    [timePresetKey.last_120_days]: 120,
    [timePresetKey.last_180_days]: 180,
    [timePresetKey.last_365_days]: 365,
  };
  const amount = dayAmounts[preset];
  if (amount) {
    return [startOf(addDate(now, -(amount - 1), relativeUnit.day), "day"), end];
  }

  if (preset === timePresetKey.today || preset === timePresetKey.last_1_day) {
    return [startOf(now, "day"), end];
  }
  if (preset === timePresetKey.yesterday) {
    const date = addDate(now, -1, relativeUnit.day);
    return [startOf(date, "day"), endOf(date, "day")];
  }
  if (preset === timePresetKey.day_before_yesterday) {
    const date = addDate(now, -2, relativeUnit.day);
    return [startOf(date, "day"), endOf(date, "day")];
  }
  if (preset === timePresetKey.this_week) return [getStartOfWeek(now), end];
  if (preset === timePresetKey.last_week) {
    const thisWeekStart = getStartOfWeek(now);
    const lastWeekStart = addDate(thisWeekStart, -7, relativeUnit.day);
    return [lastWeekStart, endOf(addDate(thisWeekStart, -1, relativeUnit.day), "day")];
  }
  if (preset === timePresetKey.this_month) return [startOf(now, "month"), end];
  if (preset === timePresetKey.last_month) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return [startOf(lastMonth, "month"), endOf(new Date(now.getFullYear(), now.getMonth(), 0), "day")];
  }
  if (preset === timePresetKey.this_year) return [startOf(now, "year"), end];

  return [startOf(addDate(now, -89, relativeUnit.day), "day"), end];
}

export function getRangeByPreset(
  preset: TimePresetKey,
  now = new Date(),
  alignToUnit = false,
  dayOnly = false,
): [Date, Date] {
  if (dayOnly) return getDayRangeByPreset(preset, now);

  const relativePreset = getRelativePresetOption(preset);

  if (relativePreset) {
    const end = alignToUnit
      ? alignTimeByUnit(now, relativePreset.unit)
      : new Date(now);
    return [addDate(end, -relativePreset.amount, relativePreset.unit), end];
  }

  const end = new Date(now);
  if (preset === timePresetKey.today) return [startOf(now, "day"), endOf(now, "day")];

  if (preset === timePresetKey.yesterday) {
    const yesterday = addDate(now, -1, relativeUnit.day);
    return [startOf(yesterday, "day"), endOf(yesterday, "day")];
  }

  if (preset === timePresetKey.day_before_yesterday) {
    const dayBeforeYesterday = addDate(now, -2, relativeUnit.day);
    return [startOf(dayBeforeYesterday, "day"), endOf(dayBeforeYesterday, "day")];
  }

  if (preset === timePresetKey.last_3_days) return [addDate(end, -3, relativeUnit.day), end];
  if (preset === timePresetKey.last_7_days) return [addDate(end, -7, relativeUnit.day), end];
  if (preset === timePresetKey.last_30_days) return [addDate(end, -30, relativeUnit.day), end];
  if (preset === timePresetKey.last_90_days) return [addDate(end, -90, relativeUnit.day), end];
  if (preset === timePresetKey.this_week) return [getStartOfWeek(now), end];

  if (preset === timePresetKey.last_week) {
    const thisWeekStart = getStartOfWeek(now);
    const lastWeekStart = addDate(thisWeekStart, -7, relativeUnit.day);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setSeconds(lastWeekEnd.getSeconds() - 1);
    return [lastWeekStart, lastWeekEnd];
  }

  if (preset === timePresetKey.this_month) return [startOf(now, "month"), end];

  if (preset === timePresetKey.last_month) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return [startOf(lastMonth, "month"), endOf(lastMonth, "month")];
  }

  if (preset === timePresetKey.this_year) return [startOf(now, "year"), end];

  return [addDate(end, -90, relativeUnit.day), end];
}

export function buildCustomRelativeRange({
  alignToUnit,
  dayOnly = false,
  now = new Date(),
  unit,
  value,
}: {
  alignToUnit: boolean;
  dayOnly?: boolean;
  now?: Date;
  unit: RelativeUnit;
  value: number;
}): [Date, Date] {
  const safeValue = Number.isFinite(value) ? Math.max(1, value) : 1;
  if (dayOnly) {
    return [
      startOf(addDate(now, -(safeValue - 1), relativeUnit.day), "day"),
      endOf(now, "day"),
    ];
  }
  const end = alignToUnit ? alignTimeByUnit(now, unit) : new Date(now);

  return [addDate(end, -safeValue, unit), end];
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthRange(monthKey: string, now = new Date()): [Date, Date] {
  const [year, month] = monthKey.split("-").map(Number);
  const monthDate = new Date(year, month - 1, 1);
  const isCurrentMonth = getMonthKey(monthDate) === getMonthKey(now);

  return [startOf(monthDate, "month"), isCurrentMonth ? new Date(now) : endOf(monthDate, "month")];
}

export function getRecentMonthKeys(now = new Date(), count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return getMonthKey(date);
  });
}

export function getCommonAbsolutePresetRanges(now = new Date(), dayOnly = false): CommonAbsolutePresetRange[] {
  if (dayOnly) {
    return [3, 7, 14, 21, 30, 90].map((amount) => ({
      key: `last_${amount}_days` as CommonAbsolutePresetKey,
      value: [
        startOf(addDate(now, -(amount - 1), relativeUnit.day), "day"),
        endOf(now, "day"),
      ],
    }));
  }

  return [
    { key: commonAbsolutePresetKey.last_3_days, value: [addDate(now, -3, relativeUnit.day), now] },
    { key: commonAbsolutePresetKey.last_7_days, value: [addDate(now, -7, relativeUnit.day), now] },
    { key: commonAbsolutePresetKey.last_14_days, value: [addDate(now, -14, relativeUnit.day), now] },
    { key: commonAbsolutePresetKey.last_21_days, value: [addDate(now, -21, relativeUnit.day), now] },
    { key: commonAbsolutePresetKey.last_30_days, value: [addDate(now, -30, relativeUnit.day), now] },
    { key: commonAbsolutePresetKey.last_90_days, value: [addDate(now, -90, relativeUnit.day), now] },
  ];
}

export function createHistoryEntry(
  input: Omit<TimeFilterHistoryItem, "createdAt" | "id">,
): TimeFilterHistoryItem {
  return {
    ...input,
    createdAt: formatDateTime(new Date()),
    id: `${input.mode}_${input.startDate}_${input.endDate}`,
  };
}

export function loadHistory(): TimeFilterHistoryItem[] {
  try {
    const stored = window.localStorage.getItem(timeFilterHistoryStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as TimeFilterHistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: TimeFilterHistoryItem[]) {
  try {
    window.localStorage.setItem(
      timeFilterHistoryStorageKey,
      JSON.stringify(history.slice(0, maxHistorySize)),
    );
  } catch {
    // Ignore storage failures so time filtering keeps working in restricted environments.
  }
}

export function upsertHistory(entry: TimeFilterHistoryItem) {
  const nextHistory = [entry, ...loadHistory().filter((item) => item.id !== entry.id)];
  saveHistory(nextHistory);
  return nextHistory.slice(0, maxHistorySize);
}

export function removeHistory(id: string) {
  const nextHistory = loadHistory().filter((item) => item.id !== id);
  saveHistory(nextHistory);
  return nextHistory;
}

export function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(value),
    template,
  );
}

export function formatCalendarMonth(date: Date, intlLocale: string) {
  return new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getAbsoluteTimeInputValue(date: Date | null, precision: TimePrecision) {
  if (!date || precision === "day") return "";

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  if (precision === "second") return `${hours}:${minutes}:${seconds}`;
  if (precision === "hour") return `${hours}:00`;
  return `${hours}:${minutes}`;
}

export function getQuickPresetGroupLabel(groupKey: string, t: (key: string) => string) {
  if (groupKey === "second") return t("timeFilter.unit.second");
  if (groupKey === "minute") return t("timeFilter.unit.minute");
  if (groupKey === "hour") return t("timeFilter.unit.hour");
  return t("timeFilter.unit.day");
}

export function getPresetLabel(labelKey: string, t: (key: string) => string) {
  return t(`timeFilter.preset.${labelKey}` as string);
}

export function getTimeRangeDisplayLabel(
  value: TimeFilterHistoryItem | TimeRangeValue,
  t: (key: string) => string,
  precision: TimePrecision = "second",
) {
  if (value.mode === historyMode.relative && value.presetKey) {
    const option = [...quickPresetOptions, ...standardPresetOptions].find(
      (item) => item.key === value.presetKey,
    );

    if (option) return getPresetLabel(option.labelKey, t);
  }

  // Absolute ranges always store a full `YYYY-MM-DD HH:mm:ss` label, including entries
  // persisted by other pages, so re-render them from the raw dates to keep day-level
  // filters from exposing the 00:00:00 / 23:59:59 boundaries.
  if (value.mode === historyMode.absolute) {
    return formatTimeRangeByPrecision(value.startDate, value.endDate, precision);
  }

  return value.label;
}

export function getUnitLabel(unit: RelativeUnit, t: (key: string) => string) {
  if (unit === relativeUnit.second) return t("timeFilter.unit.second");
  if (unit === relativeUnit.day) return t("timeFilter.unit.day");
  if (unit === relativeUnit.hour) return t("timeFilter.unit.hour");
  return t("timeFilter.unit.minute");
}

export function formatMonthLabel(monthKey: string, t: (key: string) => string) {
  const [year, month] = monthKey.split("-");
  return formatTemplate(t("timeFilter.monthFormat"), {
    month: String(Number(month)),
    year,
  });
}

export function getAbsolutePresetLabel(key: string, t: (key: string) => string) {
  if (key === "last_14_days") {
    return formatTemplate(t("timeFilter.customRelativeLabel"), {
      unit: t("timeFilter.unit.day"),
      value: "14",
    });
  }

  if (key === "last_21_days") {
    return formatTemplate(t("timeFilter.customRelativeLabel"), {
      unit: t("timeFilter.unit.day"),
      value: "21",
    });
  }

  const keyMap: Record<string, string> = {
    last_3_days: "timeFilter.preset.last3Days",
    last_7_days: "timeFilter.preset.last7Days",
    last_30_days: "timeFilter.preset.last30Days",
    last_90_days: "timeFilter.preset.last90Days",
  };

  return t(keyMap[key] ?? "timeFilter.preset.last90Days");
}

export function getSyncedTimeFilterValue(
  lastValue: TimeFilterHistoryItem | TimeRangeValue | null,
  startDate?: string,
  endDate?: string,
): TimeRangeValue | null {
  if (!startDate || !endDate) {
    return null;
  }

  const isExactMatch = lastValue?.startDate === startDate && lastValue.endDate === endDate;
  const isPresetMatch = lastValue?.presetKey && lastValue.startDate === startDate;

  if (isExactMatch || isPresetMatch) {
    return {
      ...lastValue,
      endDate,
      startDate,
    };
  }

  return {
    endDate,
    label: `${startDate} ~ ${endDate}`,
    mode: historyMode.absolute,
    startDate,
    tab: timeFilterTab.absolute,
  };
}
