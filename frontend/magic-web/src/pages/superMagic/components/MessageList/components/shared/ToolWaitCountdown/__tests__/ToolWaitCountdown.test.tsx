import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ToolWaitCountdown from "../index"

// 测试环境没有初始化 i18n；用一个只做 {{}} 插值的 t，让断言与语言包解耦。
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			`${key}:${options?.seconds}/${options?.total}`,
	}),
}))

function readLabel(container: HTMLElement): string {
	return container.querySelector("[data-testid='tool-wait-countdown'] span")?.textContent ?? ""
}

function sleepArguments(timeout: number): string {
	return JSON.stringify({ timeout })
}

describe("ToolWaitCountdown", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("renders nothing for a tool that is not the wait tool", () => {
		vi.useFakeTimers()

		const { container } = render(
			<ToolWaitCountdown
				toolCallId="spec-other-tool"
				toolName="read_file"
				status="running"
				rawArguments={sleepArguments(40)}
			/>,
		)

		expect(container.querySelector("[data-testid='tool-wait-countdown']")).toBeNull()
		// 非等待工具不应起每秒定时器，否则消息列表里每个进行中的工具卡都会空转。
		expect(vi.getTimerCount()).toBe(0)
	})

	it("renders nothing once the tool reached a terminal status", () => {
		vi.useFakeTimers()

		for (const status of ["finished", "error", "suspended", "response_missing"]) {
			const { container } = render(
				<ToolWaitCountdown
					toolCallId={`spec-terminal-${status}`}
					toolName="shell_await"
					status={status}
					rawArguments={sleepArguments(40)}
				/>,
			)

			expect(container.querySelector("[data-testid='tool-wait-countdown']")).toBeNull()
			expect(vi.getTimerCount()).toBe(0)
		}
	})

	it("renders nothing when shell_await waits for a background command", () => {
		vi.useFakeTimers()

		const { container } = render(
			<ToolWaitCountdown
				toolCallId="spec-background-wait"
				toolName="shell_await"
				status="running"
				rawArguments={JSON.stringify({ task_id: "task-1", timeout: 40 })}
			/>,
		)

		// 带 task_id 是等待后台命令，可能提前返回，没有确定的等待时长。
		expect(container.querySelector("[data-testid='tool-wait-countdown']")).toBeNull()
		expect(vi.getTimerCount()).toBe(0)
	})

	it("renders nothing while the streamed arguments are still incomplete JSON", () => {
		vi.useFakeTimers()

		const { container } = render(
			<ToolWaitCountdown
				toolCallId="spec-partial-json"
				toolName="shell_await"
				status="running"
				rawArguments='{"timeout": 4'
			/>,
		)

		expect(container.querySelector("[data-testid='tool-wait-countdown']")).toBeNull()
		expect(vi.getTimerCount()).toBe(0)
	})

	it("ticks the elapsed seconds while a pure sleep is running", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { container } = render(
			<ToolWaitCountdown
				toolCallId="spec-tick"
				toolName="shell_await"
				status="running"
				rawArguments={sleepArguments(40)}
			/>,
		)

		expect(vi.getTimerCount()).toBe(1)
		expect(readLabel(container)).toBe("toolWaitCountdown.elapsed:0/40")

		act(() => {
			vi.advanceTimersByTime(12_000)
		})

		expect(readLabel(container)).toBe("toolWaitCountdown.elapsed:12/40")
	})

	it("caps the elapsed seconds at the requested duration", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { container } = render(
			<ToolWaitCountdown
				toolCallId="spec-cap"
				toolName="shell_await"
				status="running"
				rawArguments={sleepArguments(40)}
			/>,
		)

		act(() => {
			vi.advanceTimersByTime(45_000)
		})

		// sleep 不会超过自己请求的时长，沙箱慢时也不显示「已等待 45 秒 / 共 40 秒」。
		expect(readLabel(container)).toBe("toolWaitCountdown.elapsed:40/40")
	})

	it("falls back to the backend default duration when timeout is absent", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { container } = render(
			<ToolWaitCountdown
				toolCallId="spec-default-duration"
				toolName="shell_await"
				status="running"
				rawArguments="{}"
			/>,
		)

		// 后端 SLEEP 分支的默认值是 30 秒。
		expect(readLabel(container)).toBe("toolWaitCountdown.elapsed:0/30")
	})

	it("stops ticking and unmounts the label when the tool finishes", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))

		const { container, rerender } = render(
			<ToolWaitCountdown
				toolCallId="spec-settle"
				toolName="shell_await"
				status="running"
				rawArguments={sleepArguments(40)}
			/>,
		)

		act(() => {
			vi.advanceTimersByTime(5_000)
		})
		expect(vi.getTimerCount()).toBe(1)

		rerender(
			<ToolWaitCountdown
				toolCallId="spec-settle"
				toolName="shell_await"
				status="finished"
				rawArguments={sleepArguments(40)}
			/>,
		)

		expect(container.querySelector("[data-testid='tool-wait-countdown']")).toBeNull()
		expect(vi.getTimerCount()).toBe(0)
	})
})
