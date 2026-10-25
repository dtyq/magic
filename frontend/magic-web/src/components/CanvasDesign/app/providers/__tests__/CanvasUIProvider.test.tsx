import { act, render, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../runtime/core/Canvas"
import { EventEmitter } from "../../../runtime/core/EventEmitter"
import { CanvasProvider, useCanvas } from "../CanvasProvider"
import { CanvasUIProvider, useCanvasUI } from "../CanvasUIProvider"

function createCanvasStub() {
	const eventEmitter = new EventEmitter()
	const cancelRename = vi.fn()
	const canvas = {
		eventEmitter,
		permissionManager: { can: vi.fn(() => true) },
		elementManager: {
			getAllElements: vi.fn(() => []),
			getElementData: vi.fn(),
		},
		elementRenameManager: {
			cancelRename,
			getRenamingElementId: vi.fn(() => null),
		},
	} as unknown as Canvas

	return { canvas, cancelRename, eventEmitter }
}

function CanvasUIHarness({
	canvas,
	onReady,
}: {
	canvas: Canvas
	onReady: (value: ReturnType<typeof useCanvasUI>) => void
}) {
	const { setCanvas } = useCanvas()

	useEffect(() => {
		setCanvas(canvas)
		return () => setCanvas(null)
	}, [canvas, setCanvas])

	return (
		<CanvasUIProvider>
			<CanvasUIConsumer onReady={onReady} />
		</CanvasUIProvider>
	)
}

function CanvasUIConsumer({
	onReady,
}: {
	onReady: (value: ReturnType<typeof useCanvasUI>) => void
}) {
	const value = useCanvasUI()

	useEffect(() => {
		onReady(value)
	}, [onReady, value])

	return null
}

describe("CanvasUIProvider panel exclusivity", () => {
	it("closes the rename surface and runtime session before opening history", async () => {
		const { canvas, cancelRename, eventEmitter } = createCanvasStub()
		let ui: ReturnType<typeof useCanvasUI> | undefined
		const onReady = (value: ReturnType<typeof useCanvasUI>) => {
			ui = value
		}

		render(
			<CanvasProvider>
				<CanvasUIHarness canvas={canvas} onReady={onReady} />
			</CanvasProvider>,
		)

		await waitFor(() => {
			expect(ui).toBeDefined()
			expect(eventEmitter.listenerCount("element:image:infoButtonClick")).toBe(1)
		})

		act(() => ui?.openCanvasRename("image-1"))
		await waitFor(() => expect(ui?.canvasRenamingElementId).toBe("image-1"))

		act(() => {
			eventEmitter.emit({
				type: "element:select",
				data: { elementIds: ["image-1"] },
			})
			eventEmitter.emit({
				type: "element:image:infoButtonClick",
				data: { elementId: "image-1", contentId: "content-1" },
			})
		})

		await waitFor(() => {
			expect(ui?.canvasRenamingElementId).toBeNull()
			expect(ui?.messageHistoryElementId).toBe("image-1")
			expect(ui?.messageHistoryContentId).toBe("content-1")
		})
		expect(cancelRename).toHaveBeenCalledTimes(1)
	})

	it("closes history before opening the rename surface", async () => {
		const { canvas, eventEmitter } = createCanvasStub()
		let ui: ReturnType<typeof useCanvasUI> | undefined
		const onReady = (value: ReturnType<typeof useCanvasUI>) => {
			ui = value
		}

		render(
			<CanvasProvider>
				<CanvasUIHarness canvas={canvas} onReady={onReady} />
			</CanvasProvider>,
		)

		await waitFor(() => {
			expect(ui).toBeDefined()
			expect(eventEmitter.listenerCount("element:rename-start")).toBe(1)
		})

		act(() => {
			eventEmitter.emit({
				type: "element:select",
				data: { elementIds: ["image-1"] },
			})
			ui?.openMessageHistory("image-1", "content-1")
		})
		await waitFor(() => expect(ui?.messageHistoryElementId).toBe("image-1"))

		act(() => {
			eventEmitter.emit({
				type: "element:rename-start",
				data: { elementId: "image-1" },
			})
		})

		await waitFor(() => {
			expect(ui?.messageHistoryElementId).toBeNull()
			expect(ui?.messageHistoryContentId).toBeUndefined()
			expect(ui?.canvasRenamingElementId).toBe("image-1")
		})
	})

	it("keeps the version panel exclusive and closes it when the anchor is deselected", async () => {
		const { canvas, eventEmitter } = createCanvasStub()
		let ui: ReturnType<typeof useCanvasUI> | undefined
		const onReady = (value: ReturnType<typeof useCanvasUI>) => {
			ui = value
		}

		render(
			<CanvasProvider>
				<CanvasUIHarness canvas={canvas} onReady={onReady} />
			</CanvasProvider>,
		)

		await waitFor(() => expect(ui).toBeDefined())

		act(() => {
			eventEmitter.emit({
				type: "element:select",
				data: { elementIds: ["image-1"] },
			})
			ui?.openMessageHistory("image-1", "content-1")
			ui?.toggleVersionPanel("image-1")
		})

		await waitFor(() => {
			expect(ui?.messageHistoryElementId).toBeNull()
			expect(ui?.versionPanelElementId).toBe("image-1")
		})

		act(() => {
			eventEmitter.emit({ type: "element:deselect", data: {} })
		})

		await waitFor(() => expect(ui?.versionPanelElementId).toBeNull())
	})

	it("closes the version panel when the document lifecycle changes", async () => {
		const { canvas, eventEmitter } = createCanvasStub()
		let ui: ReturnType<typeof useCanvasUI> | undefined
		const onReady = (value: ReturnType<typeof useCanvasUI>) => {
			ui = value
		}

		render(
			<CanvasProvider>
				<CanvasUIHarness canvas={canvas} onReady={onReady} />
			</CanvasProvider>,
		)
		await waitFor(() => expect(ui).toBeDefined())

		act(() => {
			eventEmitter.emit({ type: "element:select", data: { elementIds: ["image-1"] } })
			ui?.toggleVersionPanel("image-1")
		})
		await waitFor(() => expect(ui?.versionPanelElementId).toBe("image-1"))

		act(() => {
			eventEmitter.emit({ type: "document:loaded", data: undefined })
		})
		await waitFor(() => expect(ui?.versionPanelElementId).toBeNull())
	})
})
