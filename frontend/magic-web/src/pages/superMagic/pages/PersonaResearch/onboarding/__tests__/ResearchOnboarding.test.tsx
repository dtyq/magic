import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ResearchOnboarding from "../ResearchOnboarding"
import { hasSeenResearchOnboarding, requestResearchOnboarding } from "../onboardingState"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/models/user/hooks", () => ({ useUserInfo: () => ({ userInfo: { magic_id: "u1" } }) }))
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }))
vi.mock("@/pages/superMagic/components/LazyGuideTour/GuideTourManager", () => ({
	isHomeOnboardingRunBlocking: () => false,
}))
// The controller is under test, not the spotlight: a stand-in exposes its two exits.
vi.mock("../ResearchSpotlight", () => ({
	default: ({ onClose }: { onClose: (outcome: string) => void }) => (
		<div data-testid="tour">
			<button type="button" onClick={() => onClose("skipped")}>
				skip
			</button>
		</div>
	),
}))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	cleanup()
	vi.useRealTimers()
	localStorage.clear()
})

function settle() {
	act(() => {
		vi.advanceTimersByTime(1100)
	})
}

describe("ResearchOnboarding", () => {
	it("waits for a busy study to come to rest before the first run", () => {
		const { rerender } = render(<ResearchOnboarding page="studio" ready deferred />)
		settle()
		expect(screen.queryByTestId("tour")).toBeNull()

		rerender(<ResearchOnboarding page="studio" ready deferred={false} />)
		settle()
		expect(screen.getByTestId("tour")).toBeTruthy()

		fireEvent.click(screen.getByText("skip"))
		expect(hasSeenResearchOnboarding("studio", "u1")).toBe(true)
	})

	it("closes without marking seen when a question appears mid-tour", () => {
		const { rerender } = render(<ResearchOnboarding page="studio" ready />)
		settle()
		expect(screen.getByTestId("tour")).toBeTruthy()

		rerender(<ResearchOnboarding page="studio" ready deferred interrupted />)
		expect(screen.queryByTestId("tour")).toBeNull()
		expect(hasSeenResearchOnboarding("studio", "u1")).toBe(false)
	})

	it("still replays on request while a question is waiting", () => {
		render(<ResearchOnboarding page="studio" ready deferred interrupted />)
		settle()
		expect(screen.queryByTestId("tour")).toBeNull()

		act(() => requestResearchOnboarding("studio"))
		expect(screen.getByTestId("tour")).toBeTruthy()
	})
})
