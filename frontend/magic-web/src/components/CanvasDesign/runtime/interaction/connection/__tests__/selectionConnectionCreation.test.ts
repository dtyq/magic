import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import type { SelectionContentSnapshot } from "../../selection/selectionContentCollector"
import { createElementFromSelectionConnection } from "../selectionConnectionCreation"

function createSnapshot(
	overrides: Partial<SelectionContentSnapshot> = {},
): SelectionContentSnapshot {
	return {
		rootElementIds: ["root-1", "root-2"],
		items: [],
		imageSequence: [],
		videoSequence: [],
		mainVideoSequence: [],
		audioSequence: [],
		counts: { image: 0, video: 0, audio: 0, text: 2 },
		boundingRect: { x: 10, y: 20, width: 300, height: 160 },
		selectionRevision: "root-1\u0000root-2",
		allRootsCanConnect: true,
		...overrides,
	}
}

function createCanvas(connectionStatus: "created" | "invalid") {
	const connectElementsBatch = vi.fn(({ edges }) =>
		connectionStatus === "created"
			? {
					status: "created" as const,
					connectionIds: edges.map((_: unknown, index: number) => `connection-${index}`),
				}
			: { status: "invalid" as const, reason: "already-connected" as const },
	)
	const remove = vi.fn()
	const runTransaction = vi.fn(
		(callback: () => string | null, shouldRecord: (result: string | null) => boolean) => {
			const result = callback()
			shouldRecord(result)
			return result
		},
	)
	const canvas = {
		historyManager: { runTransaction },
		connectionManager: { connectElementsBatch },
		elementManager: { delete: remove },
	} as unknown as Canvas

	return { canvas, connectElementsBatch, remove, runTransaction }
}

describe("createElementFromSelectionConnection", () => {
	it.each([
		{
			side: "right" as const,
			edges: [
				{ sourceElementId: "root-1", targetElementId: "created" },
				{ sourceElementId: "root-2", targetElementId: "created" },
			],
		},
		{
			side: "left" as const,
			edges: [
				{ sourceElementId: "created", targetElementId: "root-1" },
				{ sourceElementId: "created", targetElementId: "root-2" },
			],
		},
	])("creates all $side-side edges in one transaction", ({ side, edges }) => {
		const { canvas, connectElementsBatch, runTransaction } = createCanvas("created")
		const afterConnect = vi.fn()

		const result = createElementFromSelectionConnection({
			canvas,
			snapshot: createSnapshot(),
			originSide: side,
			createElement: () => "created",
			afterConnect,
		})

		expect(result).toBe("created")
		expect(runTransaction).toHaveBeenCalledTimes(1)
		expect(connectElementsBatch).toHaveBeenCalledWith({ edges })
		expect(afterConnect).toHaveBeenCalledWith({
			createdElementId: "created",
			connectionIds: ["connection-0", "connection-1"],
		})
	})

	it("rolls back the created element when the batch is rejected", () => {
		const { canvas, connectElementsBatch, remove } = createCanvas("invalid")
		const rollbackElement = vi.fn()
		const afterConnect = vi.fn()

		const result = createElementFromSelectionConnection({
			canvas,
			snapshot: createSnapshot(),
			originSide: "right",
			createElement: () => "created",
			rollbackElement,
			afterConnect,
		})

		expect(result).toBeNull()
		expect(connectElementsBatch).toHaveBeenCalledTimes(1)
		expect(rollbackElement).toHaveBeenCalledWith("created")
		expect(remove).not.toHaveBeenCalled()
		expect(afterConnect).not.toHaveBeenCalled()
	})

	it("does not create an element for an invalid selection snapshot", () => {
		const { canvas, connectElementsBatch, runTransaction } = createCanvas("created")
		const createElement = vi.fn(() => "created")

		const result = createElementFromSelectionConnection({
			canvas,
			snapshot: createSnapshot({ allRootsCanConnect: false }),
			originSide: "right",
			createElement,
		})

		expect(result).toBeNull()
		expect(runTransaction).not.toHaveBeenCalled()
		expect(createElement).not.toHaveBeenCalled()
		expect(connectElementsBatch).not.toHaveBeenCalled()
	})
})
