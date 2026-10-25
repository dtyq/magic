import { cloneElement, Suspense, type ReactElement } from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
	isAllowed: true,
	isLoading: false,
	permissions: { "magic_claw.access": true },
	error: undefined,
	mutate: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/hooks/useFunctionPermission", () => ({ useFunctionPermission: () => state }))
vi.mock("@/apis", () => ({ FUNCTION_PERMISSION_CODE: { MagicClawAccess: "magic_claw.access" } }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/pages/superMagic/pages/MagiClawPage", () => ({
	default: () => <input aria-label="claw-draft" />,
}))
vi.mock("@/pages/superMagic/pages/ClawPlayground", () => ({ default: () => <div>playground</div> }))
import routes from "../routes"

function page() {
	return <Suspense fallback={null}>{cloneElement(routes[0].element as ReactElement)}</Suspense>
}

beforeEach(() => {
	state.mutate.mockResolvedValue({})
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.restoreAllMocks()
	state.isAllowed = true
	state.isLoading = false
	state.mutate.mockClear()
})

describe("Magic Claw access lifecycle", () => {
	it("preserves the active page while permissions refresh and explains revocation", async () => {
		const view = render(page())
		const draft = await screen.findByLabelText("claw-draft")
		state.isLoading = true
		view.rerender(page())
		expect(screen.getByLabelText("claw-draft")).toBe(draft)
		state.isLoading = false
		state.isAllowed = false
		view.rerender(page())
		expect(screen.queryByLabelText("claw-draft")).toBeNull()
		expect(screen.getByText("clawRuntime.accessRevoked")).toBeTruthy()
	})

	it("refreshes only while visible, recovers after suspension, and cleans up on leave", async () => {
		vi.useFakeTimers()
		const visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
		const view = render(page())
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000)
		})
		expect(state.mutate).not.toHaveBeenCalled()
		visible.mockReturnValue("visible")
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
		})
		expect(state.mutate).toHaveBeenCalledTimes(1)
		view.unmount()
		await act(async () => {
			await vi.advanceTimersByTimeAsync(60_000)
			window.dispatchEvent(new Event("online"))
		})
		expect(state.mutate).toHaveBeenCalledTimes(1)
	})
})
