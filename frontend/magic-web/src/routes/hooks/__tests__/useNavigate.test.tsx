import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"

const mocks = vi.hoisted(() => ({
	historyGo: vi.fn(),
	historyPush: vi.fn(),
	startTransition: vi.fn((callback: () => void) => callback()),
}))

vi.mock("@/routes/history", () => ({
	history: {
		go: mocks.historyGo,
		push: mocks.historyPush,
		replace: vi.fn(),
	},
}))

vi.mock("@/hooks/use-view-transition", () => ({
	useViewTransition: () => ({ startTransition: mocks.startTransition }),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => true,
}))

import { useNavigate } from "@/routes/hooks/useNavigate"

describe("useNavigate delta fallback", () => {
	beforeEach(() => {
		mocks.historyGo.mockReset()
		mocks.historyPush.mockReset()
		mocks.startTransition.mockClear()
		Object.defineProperty(window, "history", {
			value: { length: 1 },
			writable: true,
			configurable: true,
		})
	})

	it("uses per-call name when history is insufficient", () => {
		const { result } = renderHook(() => useNavigate())

		act(() => {
			result.current({
				delta: -1,
				name: RouteName.SuperChatsList,
				viewTransition: false,
			})
		})

		expect(mocks.historyGo).not.toHaveBeenCalled()
		expect(mocks.historyPush).toHaveBeenCalledWith({
			name: RouteName.SuperChatsList,
			params: undefined,
			query: undefined,
			state: undefined,
		})
	})

	it("prefers per-call name over hook fallbackRoute when history is insufficient", () => {
		const { result } = renderHook(() =>
			useNavigate({
				fallbackRoute: { name: RouteName.Super },
			}),
		)

		act(() => {
			result.current({
				delta: -1,
				name: RouteName.SuperWorkspacesList,
				viewTransition: false,
			})
		})

		expect(mocks.historyPush).toHaveBeenCalledWith(
			expect.objectContaining({ name: RouteName.SuperWorkspacesList }),
		)
	})

	it("uses hook fallbackRoute when per-call name is omitted", () => {
		const { result } = renderHook(() =>
			useNavigate({
				fallbackRoute: { name: RouteName.Super, params: { clusterCode: "global" } },
			}),
		)

		act(() => {
			result.current({
				delta: -1,
				viewTransition: false,
			})
		})

		expect(mocks.historyPush).toHaveBeenCalledWith({
			name: RouteName.Super,
			params: { clusterCode: "global" },
			query: undefined,
			state: undefined,
		})
	})

	it("calls history.go when history length is sufficient", () => {
		Object.defineProperty(window, "history", {
			value: { length: 5 },
			writable: true,
			configurable: true,
		})

		const { result } = renderHook(() => useNavigate())

		act(() => {
			result.current({
				delta: -1,
				name: RouteName.SuperChatsList,
				viewTransition: false,
			})
		})

		expect(mocks.historyGo).toHaveBeenCalledWith(-1)
		expect(mocks.historyPush).not.toHaveBeenCalled()
	})
})
