import { afterEach, describe, expect, it, vi } from "vitest"
import {
	findResearchOnboardingAnchor,
	hasSeenResearchOnboarding,
	markResearchOnboardingSeen,
	requestResearchOnboarding,
	researchOnboardingSeenKey,
	subscribeResearchOnboardingReplay,
} from "../onboardingState"

afterEach(() => {
	localStorage.clear()
	document.body.innerHTML = ""
	vi.restoreAllMocks()
})

describe("research onboarding seen state", () => {
	it("is recorded per page and per user", () => {
		markResearchOnboardingSeen("home", "u1")
		expect(hasSeenResearchOnboarding("home", "u1")).toBe(true)
		expect(hasSeenResearchOnboarding("studio", "u1")).toBe(false)
		expect(hasSeenResearchOnboarding("home", "u2")).toBe(false)
	})

	it("uses a versioned key so a reworked tour can be shown again", () => {
		expect(researchOnboardingSeenKey("studio", "u1")).toContain(
			"persona-research-onboarding:studio:v1:u1",
		)
	})

	it("treats unreadable storage as seen instead of replaying on every visit", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked")
		})
		expect(hasSeenResearchOnboarding("home", "u1")).toBe(true)
	})
})

describe("research onboarding replay", () => {
	it("only wakes the tour of the requested page", () => {
		const home = vi.fn()
		const studio = vi.fn()
		const stopHome = subscribeResearchOnboardingReplay("home", home)
		const stopStudio = subscribeResearchOnboardingReplay("studio", studio)
		requestResearchOnboarding("studio")
		expect(home).not.toHaveBeenCalled()
		expect(studio).toHaveBeenCalledTimes(1)
		stopHome()
		stopStudio()
		requestResearchOnboarding("studio")
		expect(studio).toHaveBeenCalledTimes(1)
	})
})

describe("findResearchOnboardingAnchor", () => {
	it("ignores anchors that are not laid out", () => {
		document.body.innerHTML = `<div data-guide-anchor="a"></div>`
		const element = document.querySelector("[data-guide-anchor]") as HTMLElement
		expect(findResearchOnboardingAnchor("a")).toBeNull()
		vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 40, 20))
		expect(findResearchOnboardingAnchor("a")).toBe(element)
		expect(findResearchOnboardingAnchor("missing")).toBeNull()
	})
})
