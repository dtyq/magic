import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { createElementFromElementConnection } from "../elementConnectionCreation"

function createCanvas(connectionStatus: "created" | "invalid") {
	let shouldRecordResult: boolean | undefined
	const connectElements = vi.fn(() =>
		connectionStatus === "created"
			? ({ status: "created", connectionId: "connection-1" } as const)
			: ({ status: "invalid", reason: "missing-element" } as const),
	)
	const remove = vi.fn()
	const runTransaction = vi.fn(
		(callback: () => string | null, shouldRecord?: (result: string | null) => boolean) => {
			const result = callback()
			shouldRecordResult = shouldRecord?.(result)
			return result
		},
	)
	const canvas = {
		connectionManager: { connectElements },
		elementManager: { delete: remove },
		historyManager: { runTransaction },
	} as unknown as Canvas

	return {
		canvas,
		connectElements,
		remove,
		runTransaction,
		getShouldRecordResult: () => shouldRecordResult,
	}
}

describe("createElementFromElementConnection", () => {
	it.each([
		["right", { sourceElementId: "origin", targetElementId: "created" }],
		["left", { sourceElementId: "created", targetElementId: "origin" }],
	] as const)("creates the %s-side connection in one transaction", (side, expectedEdge) => {
		const { canvas, connectElements, getShouldRecordResult, runTransaction } =
			createCanvas("created")
		const afterConnect = vi.fn()

		const result = createElementFromElementConnection({
			canvas,
			origin: { kind: "element", elementId: "origin", side },
			createElement: () => "created",
			afterConnect,
		})

		expect(result).toBe("created")
		expect(runTransaction).toHaveBeenCalledTimes(1)
		expect(connectElements).toHaveBeenCalledWith(expectedEdge)
		expect(afterConnect).toHaveBeenCalledWith({
			createdElementId: "created",
			connectionIds: ["connection-1"],
		})
		expect(getShouldRecordResult()).toBe(true)
	})

	it("rolls back the element and skips history when connecting fails", () => {
		const { canvas, connectElements, getShouldRecordResult } = createCanvas("invalid")
		const rollbackElement = vi.fn()

		const result = createElementFromElementConnection({
			canvas,
			origin: { kind: "element", elementId: "origin", side: "right" },
			createElement: () => "created",
			rollbackElement,
		})

		expect(result).toBeNull()
		expect(connectElements).toHaveBeenCalledTimes(1)
		expect(rollbackElement).toHaveBeenCalledWith("created")
		expect(getShouldRecordResult()).toBe(false)
	})

	it("uses the default element deletion rollback", () => {
		const { canvas, remove } = createCanvas("invalid")

		createElementFromElementConnection({
			canvas,
			origin: { kind: "element", elementId: "origin", side: "right" },
			createElement: () => "created",
		})

		expect(remove).toHaveBeenCalledWith("created")
	})
})
