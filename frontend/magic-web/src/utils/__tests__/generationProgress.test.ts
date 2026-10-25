import { describe, it, expect } from "vitest"
import { parseBackendDateTime, resolveGenerationProgress } from "../generationProgress"

/** 兜底预计耗时（秒），与 generationProgress.ts 里的常量保持一致。 */
const FALLBACK_SECONDS = 90

describe("resolveGenerationProgress", () => {
	it("reports 100 for completed regardless of elapsed time", () => {
		expect(resolveGenerationProgress({ startedAtMs: 0, status: "completed", nowMs: 0 })).toBe(
			100,
		)
	})

	it("starts at 1% when nothing has elapsed", () => {
		expect(
			resolveGenerationProgress({
				startedAtMs: 1_000,
				status: "processing",
				nowMs: 1_000,
			}),
		).toBe(1)
	})

	it("walks linearly over the fallback duration when no expected finish time is given", () => {
		// 兜底 90 秒：走过 45 秒即一半。
		expect(
			resolveGenerationProgress({
				startedAtMs: 0,
				status: "processing",
				nowMs: FALLBACK_SECONDS * 0.5 * 1000,
			}),
		).toBe(50)
	})

	it("derives the duration from the backend start and expected finish times", () => {
		const startedAtMs = Date.parse("2026-09-28T20:42:46+08:00")
		// 后端说 100 秒完成，走过 30 秒即 30%，与兜底 90 秒的口径不同。
		expect(
			resolveGenerationProgress({
				startedAtMs,
				status: "processing",
				startedAt: "2026-09-28T20:42:46+08:00",
				expectedFinishedAt: "2026-09-28T20:44:26+08:00",
				nowMs: startedAtMs + 30_000,
			}),
		).toBe(30)
	})

	it("shows the same percentage when Canvas and Agent observe different start times", () => {
		const startedAtMs = Date.parse("2026-09-28T20:42:46+08:00")
		const common = {
			status: "processing" as const,
			startedAt: "2026-09-28T20:42:46+08:00",
			expectedFinishedAt: "2026-09-28T20:44:26+08:00",
			nowMs: startedAtMs + 30_000,
		}
		const canvasPercent = resolveGenerationProgress({
			...common,
			startedAtMs: startedAtMs - 8_000,
		})
		const agentPercent = resolveGenerationProgress({
			...common,
			startedAtMs: startedAtMs + 7_000,
		})

		expect(canvasPercent).toBe(30)
		expect(agentPercent).toBe(canvasPercent)
	})

	it("never exceeds 99 while still running", () => {
		expect(
			resolveGenerationProgress({
				startedAtMs: 0,
				status: "processing",
				nowMs: FALLBACK_SECONDS * 1000,
			}),
		).toBe(99)
		expect(
			resolveGenerationProgress({
				startedAtMs: 0,
				status: "processing",
				nowMs: FALLBACK_SECONDS * 1000 * 10,
			}),
		).toBe(99)
	})

	it("increases monotonically as time passes", () => {
		const samples = Array.from({ length: 40 }, (_, index) =>
			resolveGenerationProgress({
				startedAtMs: 0,
				status: "processing",
				nowMs: (index * FALLBACK_SECONDS * 1000) / 39,
			}),
		)

		samples.forEach((value, index) => {
			if (index === 0) return
			expect(value).toBeGreaterThanOrEqual(samples[index - 1])
		})
	})

	it("clamps a negative elapsed time to the minimum", () => {
		expect(
			resolveGenerationProgress({
				startedAtMs: 5_000,
				status: "processing",
				nowMs: 1_000,
			}),
		).toBe(1)
	})

	it("freezes failed and terminated at the moment they ended", () => {
		const endedAtMs = FALLBACK_SECONDS * 0.5 * 1000
		const expected = resolveGenerationProgress({
			startedAtMs: 0,
			status: "processing",
			nowMs: endedAtMs,
		})

		for (const status of ["failed", "terminated"] as const) {
			expect(
				resolveGenerationProgress({
					startedAtMs: 0,
					status,
					endedAtMs,
					nowMs: endedAtMs + FALLBACK_SECONDS * 1000,
				}),
			).toBe(expected)
		}
	})

	it("freezes at now when a terminal status has no endedAtMs", () => {
		expect(
			resolveGenerationProgress({
				startedAtMs: 0,
				status: "failed",
				nowMs: 0,
			}),
		).toBe(1)
	})

	it("ignores an expected finish time that precedes the start", () => {
		// 预期完成时间早于起点（时钟偏差）时必须退回兜底值，不能算出负数时长。
		const startedAtMs = Date.parse("2026-09-28T20:42:46+08:00")
		expect(
			resolveGenerationProgress({
				startedAtMs,
				status: "processing",
				expectedFinishedAt: "2026-09-28T20:42:40+08:00",
				nowMs: startedAtMs + FALLBACK_SECONDS * 0.5 * 1000,
			}),
		).toBe(50)
	})

	it("ignores an implausibly distant expected finish time", () => {
		// 时区或单位搞错会推出一个多小时的时长，必须退回兜底值，否则进度会长时间停在个位数。
		const startedAtMs = Date.parse("2026-09-28T20:42:46+08:00")
		expect(
			resolveGenerationProgress({
				startedAtMs,
				status: "processing",
				expectedFinishedAt: "2026-09-28T22:42:46+08:00",
				nowMs: startedAtMs + FALLBACK_SECONDS * 0.5 * 1000,
			}),
		).toBe(50)
	})

	it("ignores an unparseable expected finish time", () => {
		expect(
			resolveGenerationProgress({
				startedAtMs: 0,
				status: "processing",
				expectedFinishedAt: "not-a-datetime",
				nowMs: FALLBACK_SECONDS * 0.5 * 1000,
			}),
		).toBe(50)
	})

	it("returns the same number for the same inputs and instant", () => {
		const input = {
			status: "processing" as const,
			startedAtMs: 1_700_000_000_000,
			nowMs: 1_700_000_030_000,
		}

		expect(resolveGenerationProgress(input)).toBe(resolveGenerationProgress(input))
	})
})

describe("parseBackendDateTime", () => {
	it("parses the backend's local-offset ISO string", () => {
		expect(parseBackendDateTime("2026-09-28T20:42:46+08:00")).toBe(
			Date.UTC(2026, 8, 28, 12, 42, 46),
		)
	})

	it("tolerates a millisecond-precision ISO string", () => {
		expect(parseBackendDateTime("2026-09-28T20:42:46.123+08:00")).toBe(
			Date.UTC(2026, 8, 28, 12, 42, 46, 123),
		)
	})

	it("returns undefined for missing or unparseable values", () => {
		expect(parseBackendDateTime()).toBeUndefined()
		expect(parseBackendDateTime(null)).toBeUndefined()
		expect(parseBackendDateTime("")).toBeUndefined()
		expect(parseBackendDateTime("not-a-date")).toBeUndefined()
	})
})
