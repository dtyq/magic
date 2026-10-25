import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  historyMode,
  relativeUnit,
  timeFilterTab,
  timePresetKey,
} from "../../../src/components/time-filter-panel/types.ts";
import {
  alignTimeByUnit,
  buildCustomRelativeRange,
  defaultSupportedRelativeUnits,
  formatTimeRangeText,
  getQuickPresetGroups,
  getRangeByPreset,
  getCommonAbsolutePresetRanges,
  getAbsoluteTimeInputValue,
  getTimeRangeDisplayLabel,
  formatTimeRangeByPrecision,
  normalizeAbsoluteDate,
  normalizeSupportedRelativeUnits,
} from "../../../src/components/time-filter-panel/utils.ts";

describe("time filter panel relative-time contract", () => {
  it("uses minute, hour and day by default", () => {
    assert.deepEqual(defaultSupportedRelativeUnits, [
      relativeUnit.minute,
      relativeUnit.hour,
      relativeUnit.day,
    ]);
    assert.deepEqual(normalizeSupportedRelativeUnits([]), defaultSupportedRelativeUnits);
  });

  it("deduplicates and orders explicitly supported units", () => {
    assert.deepEqual(
      normalizeSupportedRelativeUnits([
        relativeUnit.day,
        relativeUnit.second,
        relativeUnit.minute,
        relativeUnit.second,
      ]),
      [relativeUnit.second, relativeUnit.minute, relativeUnit.day],
    );
  });

  it("shows the compact day presets when multiple units are supported", () => {
    const dayGroup = getQuickPresetGroups([
      relativeUnit.minute,
      relativeUnit.hour,
      relativeUnit.day,
    ]).find((group) => group.key === relativeUnit.day);

    assert.deepEqual(
      dayGroup?.options.map((option) => option.amount),
      [1, 3, 7, 30, 90],
    );
  });

  it("shows the complete day preset sequence when day is the only unit", () => {
    const [dayGroup] = getQuickPresetGroups([relativeUnit.day]);

    assert.deepEqual(
      dayGroup.options.map((option) => option.amount),
      [1, 3, 7, 14, 21, 30, 60, 90, 120, 180, 365],
    );
  });

  it("only exposes second presets when second is explicitly supported", () => {
    assert.equal(
      getQuickPresetGroups(defaultSupportedRelativeUnits).some(
        (group) => group.key === relativeUnit.second,
      ),
      false,
    );
    assert.deepEqual(
      getQuickPresetGroups([relativeUnit.second, ...defaultSupportedRelativeUnits])[0].options.map(
        (option) => option.amount,
      ),
      [1, 5, 10, 15, 30],
    );
  });

  it("calculates second-level presets and custom ranges", () => {
    const now = new Date(2026, 7, 4, 12, 30, 45, 678);
    const [presetStart, presetEnd] = getRangeByPreset(
      timePresetKey.last_15_seconds,
      now,
      false,
    );
    const [customStart, customEnd] = buildCustomRelativeRange({
      alignToUnit: true,
      now,
      unit: relativeUnit.second,
      value: 10,
    });

    assert.equal(presetEnd.getTime(), now.getTime());
    assert.equal(presetStart.getTime(), now.getTime() - 15_000);
    assert.deepEqual(customEnd, new Date(2026, 7, 4, 12, 30, 45, 0));
    assert.deepEqual(customStart, new Date(2026, 7, 4, 12, 30, 35, 0));
  });

  it("aligns ranges to the selected unit", () => {
    const now = new Date(2026, 7, 4, 12, 30, 45, 678);

    assert.deepEqual(
      alignTimeByUnit(now, relativeUnit.second),
      new Date(2026, 7, 4, 12, 30, 45, 0),
    );
    assert.deepEqual(
      alignTimeByUnit(now, relativeUnit.minute),
      new Date(2026, 7, 4, 12, 30, 0, 0),
    );
    assert.deepEqual(
      alignTimeByUnit(now, relativeUnit.hour),
      new Date(2026, 7, 4, 12, 0, 0, 0),
    );
    assert.deepEqual(
      alignTimeByUnit(now, relativeUnit.day),
      new Date(2026, 7, 4, 0, 0, 0, 0),
    );
  });

  it("supports the extended 365-day preset", () => {
    const now = new Date(2026, 7, 4, 12, 30, 45, 0);
    const [start, end] = getRangeByPreset(timePresetKey.last_365_days, now, false);

    assert.deepEqual(end, now);
    assert.deepEqual(start, new Date(2025, 7, 4, 12, 30, 45, 0));
  });

  it("formats selected ranges as date-only when only day is supported", () => {
    assert.equal(
      formatTimeRangeText("2026-08-20 00:00:00", "2026-08-27 23:59:59", true),
      "2026-08-20 ~ 2026-08-27",
    );
    assert.equal(
      formatTimeRangeText("2026-08-20 00:00:00", "2026-08-27 23:59:59"),
      "2026-08-20 00:00:00 ~ 2026-08-27 23:59:59",
    );
  });

  it("anchors every near-day shortcut to the provided latest complete day", () => {
    const latestDate = new Date(2026, 8, 13, 23, 59, 59, 999);
    const expectedRanges = [
      [timePresetKey.last_3_days, new Date(2026, 8, 11, 0, 0, 0, 0)],
      [timePresetKey.last_7_days, new Date(2026, 8, 7, 0, 0, 0, 0)],
      [timePresetKey.last_30_days, new Date(2026, 7, 15, 0, 0, 0, 0)],
    ] as const;

    for (const [preset, expectedStart] of expectedRanges) {
      const [start, end] = getRangeByPreset(preset, latestDate, false, true);
      assert.deepEqual(start, expectedStart);
      assert.deepEqual(end, latestDate);
    }
  });

  it("counts near-day presets as calendar days including today", () => {
    const now = new Date(2026, 7, 27, 15, 30, 0);
    const [start, end] = getRangeByPreset(timePresetKey.last_7_days, now, false, true);

    assert.deepEqual(start, new Date(2026, 7, 21, 0, 0, 0, 0));
    assert.deepEqual(end, new Date(2026, 7, 27, 23, 59, 59, 999));
  });

  it("counts a custom day range as calendar days including today", () => {
    const now = new Date(2026, 7, 27, 15, 30, 0);
    const [start, end] = buildCustomRelativeRange({
      alignToUnit: false,
      dayOnly: true,
      now,
      unit: relativeUnit.day,
      value: 7,
    });

    assert.deepEqual(start, new Date(2026, 7, 21, 0, 0, 0, 0));
    assert.deepEqual(end, new Date(2026, 7, 27, 23, 59, 59, 999));
  });

  it("uses calendar-day semantics for absolute near-day presets", () => {
    const now = new Date(2026, 7, 27, 15, 30, 0);
    const preset = getCommonAbsolutePresetRanges(now, true).find(
      (item) => item.key === "last_7_days",
    );

    assert.deepEqual(preset?.value, [
      new Date(2026, 7, 21, 0, 0, 0, 0),
      new Date(2026, 7, 27, 23, 59, 59, 999),
    ]);
  });

  it("normalizes absolute ranges by configured precision", () => {
    const value = new Date(2026, 7, 31, 9, 30, 15, 456);

    assert.deepEqual(
      normalizeAbsoluteDate(value, "day", "start"),
      new Date(2026, 7, 31, 0, 0, 0, 0),
    );
    assert.deepEqual(
      normalizeAbsoluteDate(value, "day", "end"),
      new Date(2026, 7, 31, 23, 59, 59, 999),
    );
    assert.deepEqual(
      normalizeAbsoluteDate(value, "minute", "end"),
      new Date(2026, 7, 31, 9, 30, 59, 0),
    );
    assert.deepEqual(
      normalizeAbsoluteDate(value, "hour", "start"),
      new Date(2026, 7, 31, 9, 0, 0, 0),
    );
    assert.deepEqual(
      normalizeAbsoluteDate(value, "hour", "end"),
      new Date(2026, 7, 31, 9, 59, 59, 0),
    );
    assert.deepEqual(
      normalizeAbsoluteDate(value, "second", "start"),
      new Date(2026, 7, 31, 9, 30, 15, 0),
    );
  });

  it("formats absolute ranges according to precision", () => {
    const start = "2026-08-31 09:30:15";
    const end = "2026-08-31 11:45:59";

    assert.equal(formatTimeRangeByPrecision(start, end, "day"), "2026-08-31 ~ 2026-08-31");
    assert.equal(
      formatTimeRangeByPrecision(start, end, "minute"),
      "2026-08-31 09:30 ~ 2026-08-31 11:45",
    );
    assert.equal(
      formatTimeRangeByPrecision(start, end, "hour"),
      "2026-08-31 09:00 ~ 2026-08-31 11:59",
    );
    assert.equal(formatTimeRangeByPrecision(start, end, "second"), `${start} ~ ${end}`);
  });

  it("keeps hour precision boundaries visible in the time fields", () => {
    assert.equal(
      getAbsoluteTimeInputValue(new Date(2026, 7, 31, 9, 0, 0), "hour"),
      "09:00",
    );
    assert.equal(
      getAbsoluteTimeInputValue(new Date(2026, 7, 31, 11, 59, 59), "hour"),
      "11:59",
    );
  });

  it("renders absolute display labels by precision instead of the stored label", () => {
    const value = {
      endDate: "2026-08-31 23:59:59",
      label: "2026-08-27 00:00:00 ~ 2026-08-31 23:59:59",
      mode: historyMode.absolute,
      startDate: "2026-08-27 00:00:00",
      tab: timeFilterTab.absolute,
    };
    const t = (key: string) => key;

    assert.equal(getTimeRangeDisplayLabel(value, t, "day"), "2026-08-27 ~ 2026-08-31");
    assert.equal(getTimeRangeDisplayLabel(value, t, "second"), value.label);
    assert.equal(getTimeRangeDisplayLabel(value, t), value.label);
  });

  it("keeps preset and custom relative display labels untouched", () => {
    const t = (key: string) => key;

    assert.equal(
      getTimeRangeDisplayLabel(
        {
          endDate: "2026-08-31 23:59:59",
          label: "ignored",
          mode: historyMode.relative,
          presetKey: timePresetKey.last_7_days,
          startDate: "2026-08-25 00:00:00",
          tab: timeFilterTab.relative,
        },
        t,
        "day",
      ),
      "timeFilter.preset.last7Days",
    );
    assert.equal(
      getTimeRangeDisplayLabel(
        {
          endDate: "2026-08-31 23:59:59",
          label: "最近 15 天",
          mode: historyMode.custom,
          startDate: "2026-08-17 00:00:00",
          tab: timeFilterTab.relative,
        },
        t,
        "day",
      ),
      "最近 15 天",
    );
  });
});
