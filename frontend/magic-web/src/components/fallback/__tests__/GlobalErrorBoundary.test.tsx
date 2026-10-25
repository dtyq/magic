import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({ error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() }),
	},
}))

vi.mock("@/platform/native", () => ({
	getNativePort: () => ({ environment: { webHasNewVersionToUpdate: vi.fn() } }),
}))

vi.mock("@/hooks/i18n/useMainTranslation", () => ({
	useMainTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/utils/env", () => ({ isDev: false }))

vi.mock("antd-style", () => ({
	createStyles: () => () => ({ styles: {} }),
}))

import GlobalErrorBoundary from "../GlobalErrorBoundary"

const OFFLINE_RELOAD_KEY = "magic:global-error-boundary:offline-reload-at"

function ThrowingChild(): never {
	throw new Error("Failed to fetch dynamically imported module")
}

describe("GlobalErrorBoundary offline reload guard", () => {
	const originalLocation = window.location
	const reload = vi.fn()

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-10-16T10:00:00Z"))
		reload.mockReset()
		window.sessionStorage.clear()
		vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false)
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...originalLocation, reload },
		})
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
		Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
	})

	it("reloads once when the first offline error happens", () => {
		render(
			<GlobalErrorBoundary>
				<ThrowingChild />
			</GlobalErrorBoundary>,
		)

		expect(reload).toHaveBeenCalledTimes(1)
		expect(window.sessionStorage.getItem(OFFLINE_RELOAD_KEY)).toBe(String(Date.now()))
	})

	it("does not reload again right after an offline reload and offers a manual refresh", () => {
		window.sessionStorage.setItem(OFFLINE_RELOAD_KEY, String(Date.now() - 2000))

		render(
			<GlobalErrorBoundary>
				<ThrowingChild />
			</GlobalErrorBoundary>,
		)
		act(() => {
			vi.advanceTimersByTime(10_000)
		})

		expect(reload).not.toHaveBeenCalled()
		expect(screen.getByText("networkTip.offline")).toBeTruthy()
		expect(screen.getByText("global.offlineDesc")).toBeTruthy()
		expect(screen.getByText("global.refresh")).toBeTruthy()
		expect(screen.queryByText("global.boundaryTitle")).toBeNull()
	})

	it("reloads to fetch the latest resources once the network comes back", () => {
		window.sessionStorage.setItem(OFFLINE_RELOAD_KEY, String(Date.now() - 2000))

		render(
			<GlobalErrorBoundary>
				<ThrowingChild />
			</GlobalErrorBoundary>,
		)
		expect(reload).not.toHaveBeenCalled()

		act(() => {
			window.dispatchEvent(new Event("online"))
		})

		expect(reload).toHaveBeenCalledTimes(1)
	})

	it("reloads again once the previous offline reload is old enough", () => {
		window.sessionStorage.setItem(OFFLINE_RELOAD_KEY, String(Date.now() - 60_000))

		render(
			<GlobalErrorBoundary>
				<ThrowingChild />
			</GlobalErrorBoundary>,
		)

		expect(reload).toHaveBeenCalledTimes(1)
	})
})
