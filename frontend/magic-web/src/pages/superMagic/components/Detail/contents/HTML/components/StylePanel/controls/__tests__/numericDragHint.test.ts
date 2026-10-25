import { afterEach, describe, expect, it } from "vitest"
import {
	NUMERIC_DRAG_HINT_STORAGE_KEY,
	claimNumericDragHint,
	hasSeenNumericDragHint,
	markNumericDragHintSeen,
	resetNumericDragHintState,
} from "../numericDragHint"

describe("numericDragHint", () => {
	afterEach(() => {
		resetNumericDragHintState()
	})

	it("allows only the first claim before the hint is persisted", () => {
		expect(hasSeenNumericDragHint()).toBe(false)
		expect(claimNumericDragHint()).toBe(true)
		expect(claimNumericDragHint()).toBe(false)
		expect(hasSeenNumericDragHint()).toBe(false)
	})

	it("does not claim again after the hint has been shown", () => {
		expect(claimNumericDragHint()).toBe(true)
		markNumericDragHintSeen()

		expect(localStorage.getItem(NUMERIC_DRAG_HINT_STORAGE_KEY)).toBe("1")
		expect(hasSeenNumericDragHint()).toBe(true)

		resetNumericDragHintState()
		localStorage.setItem(NUMERIC_DRAG_HINT_STORAGE_KEY, "1")
		expect(claimNumericDragHint()).toBe(false)
	})
})
