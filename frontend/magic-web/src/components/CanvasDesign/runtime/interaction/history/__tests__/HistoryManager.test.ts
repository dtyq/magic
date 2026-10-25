import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { EventEmitter } from "../../../core/EventEmitter"
import type { LayerElement } from "../../../document/types"
import { HistoryManager } from "../HistoryManager"

function createHistoryManager() {
	const eventEmitter = new EventEmitter()
	const exportDocument = vi.fn(() => ({ elements: [] }))
	const getTemporaryElementMetadata = vi.fn((elementId: string) =>
		elementId === "runtime-result"
			? {
					kind: "generation-result" as const,
					historyPolicy: "exclude" as const,
					clipboardPolicy: "exclude" as const,
				}
			: null,
	)
	const canvas = {
		eventEmitter,
		exportDocument,
		elementManager: { getTemporaryElementMetadata },
		canvasFileUploadManager: {
			getPendingUndoCount: () => 0,
			cancelLatestPendingUpload: () => false,
		},
		userActionRegistry: { execute: vi.fn() },
	} as unknown as Canvas

	return {
		manager: new HistoryManager({ canvas }),
		eventEmitter,
		exportDocument,
	}
}

function createUpdatedEventData(elementId: string, historyPolicy?: "include" | "exclude") {
	const data = {
		id: elementId,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as LayerElement
	return { elementId, data, previousData: data, historyPolicy }
}

describe("HistoryManager runtime-only generation elements", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("does not record runtime-only deletions", () => {
		const { eventEmitter, exportDocument } = createHistoryManager()

		eventEmitter.emit({
			type: "element:deleted",
			data: { elementId: "runtime-result", persistence: "runtime-only" },
		})

		expect(exportDocument).not.toHaveBeenCalled()
	})

	it("does not debounce history for updates to excluded generation placeholders", () => {
		vi.useFakeTimers()
		const { manager, eventEmitter, exportDocument } = createHistoryManager()

		eventEmitter.emit({
			type: "element:updated",
			data: createUpdatedEventData("runtime-result"),
		})
		vi.advanceTimersByTime(301)

		expect(manager.getSnapshot().pendingDebounce).toBe(false)
		expect(exportDocument).not.toHaveBeenCalled()
	})

	it("does not debounce updates explicitly marked as non-history", () => {
		vi.useFakeTimers()
		const { manager, eventEmitter, exportDocument } = createHistoryManager()

		eventEmitter.emit({
			type: "element:updated",
			data: createUpdatedEventData("image-1", "exclude"),
		})
		vi.advanceTimersByTime(301)

		expect(manager.getSnapshot().pendingDebounce).toBe(false)
		expect(exportDocument).not.toHaveBeenCalled()
	})

	it("records one history snapshot for a successful transaction", () => {
		const { manager, eventEmitter, exportDocument } = createHistoryManager()

		const result = manager.runTransaction(
			() => {
				eventEmitter.emit({ type: "element:created", data: { elementId: "video-edit-1" } })
				eventEmitter.emit({
					type: "connection:change",
					data: { connections: [], changedConnectionIds: ["connection-1"] },
				})
				return "video-edit-1"
			},
			(value) => value !== null,
		)

		expect(result).toBe("video-edit-1")
		expect(exportDocument).toHaveBeenCalledTimes(1)
		expect(manager.getSnapshot().historyStackSize).toBe(1)
	})

	it("does not record a transaction that rolls its changes back", () => {
		const { manager, eventEmitter, exportDocument } = createHistoryManager()

		const result = manager.runTransaction(
			() => {
				eventEmitter.emit({ type: "element:created", data: { elementId: "video-edit-1" } })
				eventEmitter.emit({ type: "element:deleted", data: { elementId: "video-edit-1" } })
				return null
			},
			(value) => value !== null,
		)

		expect(result).toBeNull()
		expect(exportDocument).not.toHaveBeenCalled()
		expect(manager.getSnapshot().historyStackSize).toBe(0)
	})

	it("records one history snapshot for a successful async transaction", async () => {
		const { manager, eventEmitter, exportDocument } = createHistoryManager()

		await manager.runAsyncTransaction(async () => {
			eventEmitter.emit({ type: "element:created", data: { elementId: "image-1" } })
			await Promise.resolve()
			eventEmitter.emit({
				type: "element:batchupdated",
				data: undefined,
			})
		})

		expect(exportDocument).toHaveBeenCalledTimes(1)
		expect(manager.getSnapshot().historyStackSize).toBe(1)
	})
})
