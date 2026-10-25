import { describe, expect, it, vi } from "vitest"
import { Canvas } from "../Canvas"

describe("Canvas access transitions", () => {
	it("ends document editing sessions when write access is revoked", () => {
		let canWrite = true
		const permissionManager = {
			can: vi.fn((capability: string) => (capability === "document.write" ? canWrite : true)),
			setAccessContext: vi.fn(() => {
				canWrite = false
				return true
			}),
			getContext: vi.fn(() => ({
				mode: "readonly",
				capabilities: new Set(),
				can: () => false,
			})),
		}
		const canvas = Object.create(Canvas.prototype) as Canvas
		Object.assign(canvas, {
			permissionManager,
			mediaPlaybackCoordinator: { pauseAll: vi.fn() },
			cropManager: { cancelCrop: vi.fn() },
			extendManager: { cancelExtend: vi.fn() },
			eraserManager: { cancelEraser: vi.fn() },
			mediaReplaceController: { cancel: vi.fn() },
			elementRenameManager: { cancelRename: vi.fn() },
			toolManager: { setActiveToolByType: vi.fn() },
			elementManager: { updateAllElementsDraggable: vi.fn() },
			selectionManager: { deselectAll: vi.fn() },
			eventEmitter: { emit: vi.fn() },
			clearPreviewContent: vi.fn(),
		})

		Canvas.prototype.setAccessContext.call(canvas, { mode: "readonly" })

		expect(canvas.cropManager.cancelCrop).toHaveBeenCalledTimes(1)
		expect(canvas.extendManager.cancelExtend).toHaveBeenCalledTimes(1)
		expect(canvas.eraserManager.cancelEraser).toHaveBeenCalledTimes(1)
		expect(canvas.mediaReplaceController.cancel).toHaveBeenCalledTimes(1)
		expect(canvas.elementRenameManager.cancelRename).toHaveBeenCalledTimes(1)
		expect(canvas.elementManager.updateAllElementsDraggable).toHaveBeenCalledTimes(1)
		expect(canvas.clearPreviewContent).not.toHaveBeenCalled()
		expect(canvas.selectionManager.deselectAll).not.toHaveBeenCalled()
		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "permission:changed",
			data: expect.objectContaining({ mode: "readonly" }),
		})
	})

	it("clears an existing selection when entering history mode", () => {
		let mode: "edit" | "history" = "edit"
		const permissionManager = {
			can: vi.fn((capability: string) => {
				if (mode === "history")
					return capability === "document.read" || capability === "interaction.preview"
				return true
			}),
			setAccessContext: vi.fn(() => {
				mode = "history"
				return true
			}),
			getContext: vi.fn(() => ({ mode, capabilities: new Set(), can: () => false })),
		}
		const deselectAll = vi.fn()
		const canvas = Object.create(Canvas.prototype) as Canvas
		Object.assign(canvas, {
			permissionManager,
			mediaPlaybackCoordinator: { pauseAll: vi.fn() },
			cropManager: { cancelCrop: vi.fn() },
			extendManager: { cancelExtend: vi.fn() },
			eraserManager: { cancelEraser: vi.fn() },
			mediaReplaceController: { cancel: vi.fn() },
			elementRenameManager: { cancelRename: vi.fn() },
			toolManager: { setActiveToolByType: vi.fn() },
			elementManager: { updateAllElementsDraggable: vi.fn() },
			selectionManager: { deselectAll },
			eventEmitter: { emit: vi.fn() },
			clearPreviewContent: vi.fn(),
		})

		Canvas.prototype.setAccessContext.call(canvas, { mode: "history" })

		expect(deselectAll).toHaveBeenCalledTimes(1)
	})

	it("ends generation editing sessions when generation access is revoked", () => {
		let canGenerate = true
		const permissionManager = {
			can: vi.fn((capability: string) =>
				capability === "sideEffect.generate" ? canGenerate : true,
			),
			setAccessContext: vi.fn(() => {
				canGenerate = false
				return true
			}),
			getContext: vi.fn(() => ({ mode: "edit", capabilities: new Set(), can: () => false })),
		}
		const canvas = Object.create(Canvas.prototype) as Canvas
		Object.assign(canvas, {
			permissionManager,
			mediaPlaybackCoordinator: { pauseAll: vi.fn() },
			cropManager: { cancelCrop: vi.fn() },
			extendManager: { cancelExtend: vi.fn() },
			eraserManager: { cancelEraser: vi.fn() },
			mediaReplaceController: { cancel: vi.fn() },
			elementRenameManager: { cancelRename: vi.fn() },
			toolManager: { setActiveToolByType: vi.fn() },
			elementManager: { updateAllElementsDraggable: vi.fn() },
			selectionManager: { deselectAll: vi.fn() },
			eventEmitter: { emit: vi.fn() },
			clearPreviewContent: vi.fn(),
		})

		Canvas.prototype.setAccessContext.call(canvas, {
			capabilities: { "sideEffect.generate": false },
		})

		expect(canvas.extendManager.cancelExtend).toHaveBeenCalledTimes(1)
		expect(canvas.eraserManager.cancelEraser).toHaveBeenCalledTimes(1)
		expect(canvas.cropManager.cancelCrop).not.toHaveBeenCalled()
		expect(canvas.mediaReplaceController.cancel).not.toHaveBeenCalled()
		expect(canvas.elementRenameManager.cancelRename).not.toHaveBeenCalled()
	})
})
