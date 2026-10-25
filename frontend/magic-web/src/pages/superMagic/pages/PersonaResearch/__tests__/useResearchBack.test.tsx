import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"
import { useResearchBack } from "../hooks/useResearchBack"

const mocks = vi.hoisted(() => ({
	isMobile: true,
	navigate: vi.fn(),
	useNavigate: vi.fn(),
}))

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => mocks.isMobile }))
vi.mock("@/routes/hooks/useNavigate", () => ({
	useNavigate: (options: unknown) => {
		mocks.useNavigate(options)
		return mocks.navigate
	},
}))

describe("useResearchBack", () => {
	beforeEach(() => {
		mocks.navigate.mockReset()
		mocks.useNavigate.mockReset()
	})

	it("follows history on phones, falling back to the research home", () => {
		mocks.isMobile = true
		const { result } = renderHook(() => useResearchBack())
		result.current()
		expect(mocks.navigate).toHaveBeenCalledWith({ delta: -1, viewTransition: false })
		expect(mocks.useNavigate).toHaveBeenCalledWith({
			fallbackRoute: { name: RouteName.PersonaResearch },
		})
	})

	it("goes to the research home on desktop, as the arrow's label says", () => {
		mocks.isMobile = false
		const { result } = renderHook(() => useResearchBack())
		result.current()
		expect(mocks.navigate).toHaveBeenCalledWith({ name: RouteName.PersonaResearch })
	})
})
