import { describe, expect, it } from "vitest"
import {
	beginExplicitScroll,
	beginHistoryAnchor,
	beginUserScroll,
	beginVirtuosoMeasurement,
	canFollowOutput,
	initialScrollOwnership,
} from "../scroll-ownership"

describe("scroll ownership", () => {
	it("rejects follow-output during an upward user gesture", () => {
		const state = beginUserScroll(initialScrollOwnership(), "backward", false)

		expect(canFollowOutput(state, { totalSizeIncreased: true, nearBottom: true })).toBe(false)
	})

	it("allows follow-output only when the latest user state is downward and near the bottom", () => {
		const state = beginUserScroll(initialScrollOwnership(), "forward", true)

		expect(canFollowOutput(state, { totalSizeIncreased: true, nearBottom: true })).toBe(true)
	})

	it("lets explicit scrolling cancel history-anchor work", () => {
		const state = beginHistoryAnchor(initialScrollOwnership(), 4)

		expect(beginExplicitScroll(state).owner).toBe("explicit")
	})

	it("does not treat a Virtuoso measurement as user intent", () => {
		const state = beginVirtuosoMeasurement(initialScrollOwnership())

		expect(state.userIntent).toBe("none")
	})
})
