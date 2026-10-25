import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"

import { ScheduledTask } from "@/types/scheduledTask"

import { formatTaskSchedule } from "../utils"

const t = ((key: string, options?: Record<string, unknown>) => {
	if (key.startsWith("format.weekDay.")) return `weekday-${key.at(-1)}`
	return `${key}:${JSON.stringify(options || {})}`
}) as TFunction

describe("formatTaskSchedule", () => {
	it("formats weekly schedules with the localized weekday", () => {
		expect(
			formatTaskSchedule(
				{
					type: ScheduledTask.ScheduleType.Weekly,
					day: "0",
					time: "09:30",
				},
				t,
			),
		).toBe('scheduleTask.weeklyAt:{"day":"weekday-7","time":"09:30"}')
	})

	it("uses the fallback copy when no schedule is available", () => {
		expect(formatTaskSchedule(undefined, t)).toBe("scheduleTask.noSchedule:{}")
	})
})
