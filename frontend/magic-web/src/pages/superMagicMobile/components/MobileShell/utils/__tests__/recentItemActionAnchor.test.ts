import { describe, expect, it } from "vitest"
import { getRecentItemActionAnchor } from "../recentItemActionAnchor"

/** Builds a minimal TouchEvent stub for coordinate extraction tests. */
function createTouchEvent(clientX: number, clientY: number): TouchEvent {
	const touch = { clientX, clientY } as Touch
	return {
		changedTouches: [touch],
		touches: [touch],
	} as TouchEvent
}

describe("getRecentItemActionAnchor", () => {
	it("reads coordinates from mouse events", () => {
		const event = { clientX: 120, clientY: 240 } as MouseEvent

		expect(getRecentItemActionAnchor(event)).toEqual({
			clientX: 120,
			clientY: 240,
		})
	})

	it("reads coordinates from touch events", () => {
		const event = createTouchEvent(80, 160)

		expect(getRecentItemActionAnchor(event)).toEqual({
			clientX: 80,
			clientY: 160,
		})
	})

	it("falls back to zero when touch lists are empty", () => {
		const event = { changedTouches: [], touches: [] } as TouchEvent

		expect(getRecentItemActionAnchor(event)).toEqual({
			clientX: 0,
			clientY: 0,
		})
	})
})
