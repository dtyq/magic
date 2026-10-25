import { describe, expect, it, vi } from "vitest"
import yaml from "js-yaml"

vi.mock("@/apis", () => ({ SuperMagicApi: {} }))
vi.mock("@/pages/superMagic/services", () => ({ loadProjectAttachments: vi.fn() }))
vi.mock("@/pages/superMagic/utils/api", () => ({
	downloadFileContent: vi.fn(),
	getFileContentById: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
}))
vi.mock("@/pages/superMagic/pages/SkillEdit/utils/skill-workspace-manifest", () => ({
	findAttachmentByRelativePath: vi.fn(),
	findDirectoryIdByRelativePath: vi.fn(),
	findDirectoryIdBySegmentWalk: vi.fn(),
	normalizeRelativeFilePath: (path?: string | null) => path || "",
}))

import {
	buildCronExpression,
	CLAW_CRON_RECURRING_CYCLE,
	getClawCronNextRuns,
	isValidClawCronExpression,
	parseClawCronTaskMarkdown,
	parseCronExpression,
	patchClawCronTaskMarkdown,
	resolveCronExpression,
	type ClawCronTaskRecord,
} from "../claw-cron-task-file"

function createCronFile(expr: string, extraSchedule = "") {
	return [
		"---",
		"created_at: '2026-10-01T16:20:00+08:00'",
		"enabled: true",
		"name: Weekly report",
		"timezone: Asia/Shanghai",
		"schedule:",
		"  kind: cron",
		`  expr: '${expr}'`,
		"  tz: Asia/Shanghai",
		extraSchedule,
		"payload:",
		"  kind: agent_turn",
		"---",
		"",
		"Summarize the week.",
	]
		.filter((line) => line !== "")
		.join("\n")
}

function parseRecord(content: string) {
	const record = parseClawCronTaskMarkdown({
		fileId: "file-1",
		relativePath: ".magic/cron/weekly-report.md",
		content,
	})
	if (!record) throw new Error("expected a parsed record")
	return record
}

function readSchedule(content: string) {
	const [, frontmatter] = content.split("---\n")
	return yaml.load(frontmatter) as { schedule: Record<string, unknown>; timezone: string }
}

describe("parseCronExpression", () => {
	it.each([
		["30 9 * * *", CLAW_CRON_RECURRING_CYCLE.Daily, "09:30", [], []],
		["0 9 * * 1-5", CLAW_CRON_RECURRING_CYCLE.Weekdays, "09:00", [], []],
		["0 9 * * MON-FRI", CLAW_CRON_RECURRING_CYCLE.Weekdays, "09:00", [], []],
		["0 9 * * 1,3,5", CLAW_CRON_RECURRING_CYCLE.Weekly, "09:00", [1, 3, 5], []],
		["0 9 * * mon,wed", CLAW_CRON_RECURRING_CYCLE.Weekly, "09:00", [1, 3], []],
		["0 18 * * 7", CLAW_CRON_RECURRING_CYCLE.Weekly, "18:00", [0], []],
		["0 18 * * 0,7", CLAW_CRON_RECURRING_CYCLE.Weekly, "18:00", [0], []],
		["5 8 1,15 * *", CLAW_CRON_RECURRING_CYCLE.Monthly, "08:05", [], [1, 15]],
		["0 9 1-3 * *", CLAW_CRON_RECURRING_CYCLE.Monthly, "09:00", [], [1, 2, 3]],
	])("maps %s to a form cycle", (expr, cycle, time, weekdays, monthDays) => {
		expect(parseCronExpression(expr)).toEqual({ cycle, time, weekdays, monthDays, expr })
	})

	it.each([
		"*/30 * * * *",
		"0 9,18 * * *",
		"0 9 L * *",
		"0 9 1 1 *",
		"0 9 1 * 1",
		"0 9 * * 1#2",
		"0 0 9 * * *",
		"0 24 * * *",
		"not a cron",
		"",
	])("falls back to custom for %s and keeps the raw text", (expr) => {
		expect(parseCronExpression(expr)).toMatchObject({
			cycle: CLAW_CRON_RECURRING_CYCLE.Custom,
			expr: expr.trim(),
		})
	})
})

describe("buildCronExpression", () => {
	const base = { time: "09:05", weekdays: [], monthDays: [], expr: "" }

	it("builds each structured cycle", () => {
		expect(buildCronExpression({ ...base, cycle: CLAW_CRON_RECURRING_CYCLE.Daily })).toBe(
			"5 9 * * *",
		)
		expect(buildCronExpression({ ...base, cycle: CLAW_CRON_RECURRING_CYCLE.Weekdays })).toBe(
			"5 9 * * 1-5",
		)
		expect(
			buildCronExpression({
				...base,
				cycle: CLAW_CRON_RECURRING_CYCLE.Weekly,
				weekdays: [5, 1, 0],
			}),
		).toBe("5 9 * * 0,1,5")
		expect(
			buildCronExpression({
				...base,
				cycle: CLAW_CRON_RECURRING_CYCLE.Monthly,
				monthDays: [15, 1],
			}),
		).toBe("5 9 1,15 * *")
	})

	it("writes a weekly selection of Monday to Friday as a range", () => {
		expect(
			buildCronExpression({
				...base,
				cycle: CLAW_CRON_RECURRING_CYCLE.Weekly,
				weekdays: [1, 2, 3, 4, 5],
			}),
		).toBe("5 9 * * 1-5")
	})

	it("returns the custom expression as is", () => {
		expect(
			buildCronExpression({
				...base,
				cycle: CLAW_CRON_RECURRING_CYCLE.Custom,
				expr: " */15 9-18 * * 1-5 ",
			}),
		).toBe("*/15 9-18 * * 1-5")
	})
})

describe("resolveCronExpression", () => {
	it("keeps the source text when the schedule is unchanged", () => {
		const source = "0 9 * * MON-FRI"
		expect(resolveCronExpression(parseCronExpression(source), source)).toBe(source)
	})

	it("rebuilds the expression after the schedule changes", () => {
		const source = "0 9 * * MON,WED"
		const config = { ...parseCronExpression(source), weekdays: [1, 3, 5] }
		expect(resolveCronExpression(config, source)).toBe("0 9 * * 1,3,5")
	})
})

describe("parse and patch a cron task file", () => {
	it.each(["0 9 * * 1", "0 9 1,15 * *", "0 9 * * MON-FRI", "0 9 L * *", "0 0 9 * * *"])(
		"saving an unchanged task keeps expr %s",
		(expr) => {
			const content = createCronFile(expr)
			const record = parseRecord(content)

			const nextContent = patchClawCronTaskMarkdown({
				originalContent: content,
				draft: record,
			})

			expect(readSchedule(nextContent).schedule.expr).toBe(expr)
		},
	)

	it("parses a weekly task into form fields", () => {
		const record = parseRecord(createCronFile("0 9 * * 1,3"))

		expect(record).toMatchObject<Partial<ClawCronTaskRecord>>({
			recurringCycle: CLAW_CRON_RECURRING_CYCLE.Weekly,
			recurringTime: "09:00",
			recurringWeekdays: [1, 3],
			recurringSourceExpr: "0 9 * * 1,3",
			timezone: "Asia/Shanghai",
		})
	})

	it("writes the edited monthly days and keeps the task time zone", () => {
		const content = createCronFile("0 9 1 * *")
		const record = parseRecord(content)

		const nextContent = patchClawCronTaskMarkdown({
			originalContent: content,
			draft: { ...record, recurringMonthDays: [1, 20] },
		})
		const parsed = readSchedule(nextContent)

		expect(parsed.schedule.expr).toBe("0 9 1,20 * *")
		expect(parsed.schedule.tz).toBe("Asia/Shanghai")
		expect(parsed.timezone).toBe("Asia/Shanghai")
	})

	it("keeps unknown schedule keys written by the agent", () => {
		const content = createCronFile("0 9 * * 1", "  stagger_ms: 1000")
		const record = parseRecord(content)

		const nextContent = patchClawCronTaskMarkdown({ originalContent: content, draft: record })

		expect(readSchedule(nextContent).schedule.stagger_ms).toBe(1000)
	})
})

describe("getClawCronNextRuns", () => {
	it("returns runs in the task time zone after the start time", () => {
		const runs = getClawCronNextRuns({
			expr: "0 9 * * 1",
			timezone: "Asia/Shanghai",
			startAt: "2099-10-05T09:00:00+08:00",
			count: 2,
		})

		expect(runs?.map((run) => run.toISOString())).toEqual([
			"2099-10-05T01:00:00.000Z",
			"2099-10-12T01:00:00.000Z",
		])
	})

	it("rejects expressions it cannot evaluate like the backend", () => {
		expect(isValidClawCronExpression("0 9 * * 1", "UTC")).toBe(true)
		expect(isValidClawCronExpression("0 25 * * *", "UTC")).toBe(false)
		expect(isValidClawCronExpression("0 0 9 * * *", "UTC")).toBe(false)
		expect(isValidClawCronExpression("", "UTC")).toBe(false)
	})
})
