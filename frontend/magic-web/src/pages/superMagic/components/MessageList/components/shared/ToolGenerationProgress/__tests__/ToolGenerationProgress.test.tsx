import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ToolGenerationProgress from "../index"

/** 后端建单成功后补发的生成详情；测试里只关心这几个字段。 */
function generationDetail(taskId?: string, expectedFinishedAt?: string, startedAt?: string) {
	return {
		type: "generation_progress",
		data: {
			media_type: "image",
			...(taskId ? { task_id: taskId } : {}),
			...(startedAt ? { started_at: startedAt } : {}),
			...(expectedFinishedAt ? { expected_finished_at: expectedFinishedAt } : {}),
		},
	}
}

function readPercent(container: HTMLElement): number {
	const label = container.querySelector("[data-testid='tool-generation-progress'] span")
	return Number((label?.textContent ?? "").replace("%", ""))
}

describe("ToolGenerationProgress", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("renders nothing without a generation detail, so non-generating tools stay untouched", () => {
		vi.useFakeTimers()

		const { container } = render(
			<ToolGenerationProgress toolCallId="spec-no-detail" status="running" />,
		)

		expect(container.querySelector("[data-testid='tool-generation-progress']")).toBeNull()
		// 没有生成详情的工具不应起每秒定时器，否则消息列表里每个进行中的工具卡都会空转。
		expect(vi.getTimerCount()).toBe(0)
	})

	it("renders nothing when another detail type happens to carry an expected finish time", () => {
		vi.useFakeTimers()

		const { container } = render(
			<ToolGenerationProgress
				toolCallId="spec-other-detail"
				status="running"
				detail={{
					type: "operation_result_list",
					data: { expected_finished_at: "2026-01-01T00:01:30Z" },
				}}
			/>,
		)

		expect(container.querySelector("[data-testid='tool-generation-progress']")).toBeNull()
		expect(vi.getTimerCount()).toBe(0)
	})

	it("renders nothing once the tool reached a strong terminal status", () => {
		vi.useFakeTimers()

		for (const status of ["finished", "error", "suspended"]) {
			const { container } = render(
				<ToolGenerationProgress
					toolCallId={`spec-terminal-${status}`}
					status={status}
					detail={generationDetail("IGT-terminal")}
				/>,
			)

			expect(container.querySelector("[data-testid='tool-generation-progress']")).toBeNull()
			expect(vi.getTimerCount()).toBe(0)
		}
	})

	it("keeps showing progress after refresh marks the historical tool response as missing", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:30Z"))

		const { container } = render(
			<ToolGenerationProgress
				toolCallId="spec-history-response-missing"
				status="response_missing"
				detail={generationDetail(
					"IGT-history-response-missing",
					"2026-01-01T00:01:30Z",
					"2026-01-01T00:00:00Z",
				)}
			/>,
		)

		// response_missing 只是“暂时没拿到真实工具结果”，不能把历史任务重置为无进度。
		expect(readPercent(container)).toBe(33)
	})

	it("ticks once per second while a generation detail is present", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { unmount } = render(
			<ToolGenerationProgress
				toolCallId="spec-tick"
				status="running"
				detail={generationDetail("IGT-tick")}
			/>,
		)

		expect(vi.getTimerCount()).toBe(1)
		unmount()
		expect(vi.getTimerCount()).toBe(0)
	})

	it("renders a percentage for any tool that declares generation progress", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		// 准入只看详情，不看工具名：画布生成、设计画布生成等未列进旧白名单的工具同样显示。
		const { container } = render(
			<ToolGenerationProgress
				toolCallId="spec-running"
				status="running"
				detail={generationDetail("IGT-running")}
			/>,
		)

		expect(readPercent(container)).toBe(1)
	})

	it("uses the backend task start time so a remount does not restart at 1%", () => {
		vi.useFakeTimers()
		const startedAt = "2026-01-01T00:00:00Z"
		const expectedFinishedAt = "2026-01-01T00:01:30Z"
		vi.setSystemTime(new Date("2026-01-01T00:00:30Z"))

		const detail = generationDetail("IGT-backend-anchor", expectedFinishedAt, startedAt)
		const { container, unmount } = render(
			<ToolGenerationProgress
				toolCallId="spec-backend-anchor"
				status="running"
				detail={detail}
			/>,
		)
		expect(readPercent(container)).toBe(33)
		unmount()

		vi.setSystemTime(new Date("2026-01-01T00:00:45Z"))
		const second = render(
			<ToolGenerationProgress
				toolCallId="spec-backend-anchor"
				status="running"
				detail={detail}
			/>,
		)
		expect(readPercent(second.container)).toBe(50)
	})

	it("falls back to the fixed duration when no expected finish time is given", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { container } = render(
			<ToolGenerationProgress
				toolCallId="spec-fallback"
				status="running"
				detail={generationDetail("IGT-fallback")}
			/>,
		)

		// 兜底 90 秒：走过 45 秒即一半。
		act(() => {
			vi.advanceTimersByTime(45_000)
		})
		expect(readPercent(container)).toBe(50)
	})

	it("keeps the anchor across a remount so the percentage never restarts", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const detail = generationDetail("IGT-remount")
		const first = render(
			<ToolGenerationProgress toolCallId="spec-remount" status="running" detail={detail} />,
		)
		expect(readPercent(first.container)).toBe(1)

		vi.setSystemTime(new Date("2026-01-01T00:00:30Z"))
		first.unmount()

		const second = render(
			<ToolGenerationProgress toolCallId="spec-remount" status="running" detail={detail} />,
		)

		// 重新挂载后如果重新取锚点，进度会退回 1%。
		expect(readPercent(second.container)).toBeGreaterThan(1)
	})

	it("drops the anchor once the tool finishes, so a new call starts fresh", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const detail = generationDetail("IGT-reuse")
		const running = render(
			<ToolGenerationProgress toolCallId="spec-reuse" status="running" detail={detail} />,
		)
		running.unmount()

		vi.setSystemTime(new Date("2026-01-01T00:01:00Z"))
		const finished = render(
			<ToolGenerationProgress toolCallId="spec-reuse" status="finished" detail={detail} />,
		)
		expect(
			finished.container.querySelector("[data-testid='tool-generation-progress']"),
		).toBeNull()
		finished.unmount()

		const restarted = render(
			<ToolGenerationProgress toolCallId="spec-reuse" status="running" detail={detail} />,
		)

		expect(readPercent(restarted.container)).toBe(1)
	})

	it("uses the backend expected_finished_at to derive the percentage", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { container } = render(
			<ToolGenerationProgress
				toolCallId="spec-eta"
				status="running"
				detail={generationDetail("IGT-eta", "2026-01-01T00:01:30Z")}
			/>,
		)
		// 刚挂载时起点即当前时间，进度从最小值开始。
		expect(readPercent(container)).toBe(1)

		// 后端预期 90s 完成，走过 30s 即 1/3。
		act(() => {
			vi.advanceTimersByTime(30_000)
		})
		expect(readPercent(container)).toBe(33)
	})

	it("anchors on the backend task id when the card has no tool call id", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const detail = generationDetail("IGT-no-tool-id")
		const first = render(<ToolGenerationProgress status="running" detail={detail} />)
		expect(readPercent(first.container)).toBe(1)
		first.unmount()

		vi.setSystemTime(new Date("2026-01-01T00:00:30Z"))
		const second = render(<ToolGenerationProgress status="running" detail={detail} />)

		// 起点按 task_id 缓存，重挂载后接着走，而不是回到最小值。
		expect(readPercent(second.container)).toBeGreaterThan(1)
	})

	it("renders nothing when neither a tool call id nor a task id is available", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { container } = render(
			<ToolGenerationProgress status="running" detail={generationDetail()} />,
		)

		// 没有键就缓存不住起点，宁可不显示进度条，也不显示一条每秒回到原点的假进度。
		expect(container.querySelector("[data-testid='tool-generation-progress']")).toBeNull()
	})
})
