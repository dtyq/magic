import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CommandHistory } from "../../core/CommandHistory"
import type { ElementSelector } from "../../features/ElementSelector"
import { ImageManager } from "../ImageManager"
import type { ImageUploadRequestPayload } from "../../../../iframe-bridge/types/messages"

interface MockElementSelector {
	getSelectedSelectors: ReturnType<typeof vi.fn>
	refreshSelection: ReturnType<typeof vi.fn>
	isSelected: ReturnType<typeof vi.fn>
	selectElement: ReturnType<typeof vi.fn>
	clearSelection: ReturnType<typeof vi.fn>
}

describe("ImageManager", () => {
	let commandHistory: CommandHistory
	let imageManager: ImageManager
	let container: HTMLDivElement
	let mockElementSelector: MockElementSelector
	let postMessageSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		commandHistory = new CommandHistory()
		mockElementSelector = {
			getSelectedSelectors: vi.fn(),
			refreshSelection: vi.fn(),
			isSelected: vi.fn(() => false),
			selectElement: vi.fn(),
			clearSelection: vi.fn(),
		}
		imageManager = new ImageManager(
			commandHistory,
			mockElementSelector as unknown as ElementSelector,
		)

		container = document.createElement("div")
		container.id = "image-manager-test-root"
		document.body.appendChild(container)

		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined)
	})

	afterEach(() => {
		postMessageSpy.mockRestore()
		container.remove()
		document
			.querySelectorAll("img[data-original-path='images/inserted.png']")
			.forEach((element) => element.remove())
		document.querySelector("#async-inserted-sibling")?.remove()
	})

	it("should set element background image through upload result", async () => {
		container.innerHTML = `
			<div
				id="target"
				style="background: url('old.jpg') center center / cover no-repeat; padding: 10px;"
			>
				Content
			</div>
		`
		mockElementSelector.getSelectedSelectors.mockReturnValue(["#target"])

		const runPromise = imageManager.runImageAction({
			action: "set-element-background-image",
		})

		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data
		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "set-element-background-image",
			selector: "#target",
			success: true,
			previewUrl: "data:image/png;base64,abc123",
			relativeFilePath: "images/new.png",
		})

		await runPromise

		const element = container.querySelector("#target") as HTMLElement
		const styleAttribute = element.getAttribute("style") || ""

		expect(styleAttribute).toContain(
			"background-image: /*__ORIGINAL_URL__:images/new.png__*/url('data:image/png;base64,abc123');",
		)
		expect(styleAttribute).toContain("background-position: center center;")
		expect(styleAttribute).toContain("background-size: cover;")
		expect(styleAttribute).toContain("background-repeat: no-repeat;")
		expect(styleAttribute).toContain("padding: 10px;")
		expect(commandHistory.getUndoStackSize()).toBe(1)
		expect(mockElementSelector.refreshSelection).toHaveBeenCalled()
	})

	it("should remove element background image and preserve background color", async () => {
		container.innerHTML = `
			<div
				id="target"
				style="background: url('old.jpg') center center / cover no-repeat rgba(255, 255, 255, 0.6); margin: 12px;"
			>
				Content
			</div>
		`
		mockElementSelector.getSelectedSelectors.mockReturnValue(["#target"])

		await imageManager.runImageAction({
			action: "remove-element-background-image",
		})

		const element = container.querySelector("#target") as HTMLElement
		const styleAttribute = element.getAttribute("style") || ""

		expect(styleAttribute).toContain("background-image: none;")
		expect(styleAttribute).toContain("background-position: center center;")
		expect(styleAttribute).toContain("background-size: cover;")
		expect(styleAttribute).toContain("background-repeat: no-repeat;")
		expect(styleAttribute).toContain("background-color: rgba(255, 255, 255, 0.6);")
		expect(styleAttribute).toContain("margin: 12px;")
		expect(commandHistory.getUndoStackSize()).toBe(1)
		expect(mockElementSelector.refreshSelection).toHaveBeenCalled()
	})

	it("should restore and reapply background image command with undo redo", async () => {
		container.innerHTML = `
			<div
				id="target"
				style="background: url('old.jpg') center center / cover no-repeat; padding: 10px;"
			>
				Content
			</div>
		`
		mockElementSelector.getSelectedSelectors.mockReturnValue(["#target"])

		const runPromise = imageManager.runImageAction({
			action: "set-element-background-image",
		})
		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "set-element-background-image",
			selector: "#target",
			success: true,
			previewUrl: "data:image/png;base64,abc123",
			relativeFilePath: "images/new.png",
		})

		await runPromise

		const element = container.querySelector("#target") as HTMLElement
		const updatedStyle = element.getAttribute("style") || ""
		expect(updatedStyle).toContain("background-image:")
		expect(updatedStyle).not.toContain("old.jpg")

		const undoCommand = commandHistory.undo()
		expect(undoCommand).not.toBeNull()
		if (!undoCommand) throw new Error("Expected undo command to exist")

		expect(imageManager.restoreCommand(undoCommand)).toBe(true)
		expect(element.getAttribute("style")).toContain(
			"background: url('old.jpg') center center / cover no-repeat;",
		)
		expect(element.getAttribute("style")).not.toContain("background-image:")

		const redoCommand = commandHistory.redo()
		expect(redoCommand).not.toBeNull()
		if (!redoCommand) throw new Error("Expected redo command to exist")

		await imageManager.applyCommand(redoCommand)

		const redoneStyle = element.getAttribute("style") || ""
		expect(redoneStyle).toContain(
			"background-image: /*__ORIGINAL_URL__:images/new.png__*/url('data:image/png;base64,abc123');",
		)
		expect(redoneStyle).toContain("background-size: cover;")
		expect(redoneStyle).not.toContain("old.jpg")
	})

	it("should keep DOM unchanged when background image upload is cancelled", async () => {
		container.innerHTML = `
			<div
				id="target"
				style="background: url('old.jpg') center center / cover no-repeat; padding: 10px;"
			>
				Content
			</div>
		`
		mockElementSelector.getSelectedSelectors.mockReturnValue(["#target"])

		const element = container.querySelector("#target") as HTMLElement
		const originalStyle = element.getAttribute("style")

		const runPromise = imageManager.runImageAction({
			action: "set-element-background-image",
		})
		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "set-element-background-image",
			selector: "#target",
			success: false,
			cancelled: true,
		})

		await expect(runPromise).resolves.toBeUndefined()
		expect(element.getAttribute("style")).toBe(originalStyle)
		expect(commandHistory.getUndoStackSize()).toBe(0)
		expect(mockElementSelector.refreshSelection).not.toHaveBeenCalled()
	})

	it("should reject and keep DOM unchanged when background image upload fails", async () => {
		container.innerHTML = `
			<div
				id="target"
				style="background: url('old.jpg') center center / cover no-repeat; padding: 10px;"
			>
				Content
			</div>
		`
		mockElementSelector.getSelectedSelectors.mockReturnValue(["#target"])

		const element = container.querySelector("#target") as HTMLElement
		const originalStyle = element.getAttribute("style")

		const runPromise = imageManager.runImageAction({
			action: "set-element-background-image",
		})
		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "set-element-background-image",
			selector: "#target",
			success: false,
			error: "Upload failed",
		})

		await expect(runPromise).rejects.toThrow("Upload failed")
		expect(element.getAttribute("style")).toBe(originalStyle)
		expect(commandHistory.getUndoStackSize()).toBe(0)
		expect(mockElementSelector.refreshSelection).not.toHaveBeenCalled()
	})

	it("should insert floating image through upload result", async () => {
		const runPromise = imageManager.runImageAction({
			action: "insert-floating-image",
		})

		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "insert-floating-image",
			selector: "body",
			success: true,
			previewUrl: "data:image/png;base64,inserted",
			relativeFilePath: "images/inserted.png",
		})

		await runPromise

		const insertedImage = document.body.querySelector(
			"img[data-original-path='images/inserted.png']",
		)
		expect(insertedImage).toBeInstanceOf(HTMLImageElement)
		expect(insertedImage?.getAttribute("src")).toBe("data:image/png;base64,inserted")
		expect((insertedImage as HTMLImageElement).style.position).toBe("absolute")
		expect((insertedImage as HTMLImageElement).style.width).toBe("240px")
		expect(commandHistory.getUndoStackSize()).toBe(1)
		expect(mockElementSelector.selectElement).toHaveBeenCalledWith(insertedImage)
	})

	it("should support undo and redo for inserted floating image", async () => {
		const runPromise = imageManager.runImageAction({
			action: "insert-floating-image",
		})

		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "insert-floating-image",
			selector: "body",
			success: true,
			previewUrl: "data:image/png;base64,inserted",
			relativeFilePath: "images/inserted.png",
		})

		await runPromise
		expect(
			document.body.querySelectorAll("img[data-original-path='images/inserted.png']"),
		).toHaveLength(1)

		const undoCommand = commandHistory.undo()
		expect(undoCommand).not.toBeNull()
		if (!undoCommand) throw new Error("Expected undo command to exist")

		expect(imageManager.restoreCommand(undoCommand)).toBe(true)
		expect(
			document.body.querySelector("img[data-original-path='images/inserted.png']"),
		).toBeNull()
		expect(mockElementSelector.clearSelection).toHaveBeenCalled()

		const redoCommand = commandHistory.redo()
		expect(redoCommand).not.toBeNull()
		if (!redoCommand) throw new Error("Expected redo command to exist")

		await imageManager.applyCommand(redoCommand)
		const restoredImage = document.body.querySelector(
			"img[data-original-path='images/inserted.png']",
		)
		expect(restoredImage).toBeInstanceOf(HTMLImageElement)
		expect((restoredImage as HTMLImageElement).style.position).toBe("absolute")
		expect(mockElementSelector.selectElement).toHaveBeenCalledWith(restoredImage)
	})

	it("should restore inserted image to actual insertion position after async DOM changes", async () => {
		const runPromise = imageManager.runImageAction({
			action: "insert-floating-image",
		})

		const asyncInsertedSibling = document.createElement("div")
		asyncInsertedSibling.id = "async-inserted-sibling"
		document.body.appendChild(asyncInsertedSibling)

		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "insert-floating-image",
			selector: "body",
			success: true,
			previewUrl: "data:image/png;base64,inserted",
			relativeFilePath: "images/inserted.png",
		})

		await runPromise

		const insertedImage = document.body.querySelector(
			"img[data-original-path='images/inserted.png']",
		) as HTMLImageElement | null
		expect(insertedImage).toBeInstanceOf(HTMLImageElement)
		if (!insertedImage) throw new Error("Expected inserted image to exist")
		expect(insertedImage.previousElementSibling).toBe(asyncInsertedSibling)

		const undoCommand = commandHistory.undo()
		expect(undoCommand).not.toBeNull()
		if (!undoCommand) throw new Error("Expected undo command to exist")
		expect(imageManager.restoreCommand(undoCommand)).toBe(true)

		const redoCommand = commandHistory.redo()
		expect(redoCommand).not.toBeNull()
		if (!redoCommand) throw new Error("Expected redo command to exist")
		await imageManager.applyCommand(redoCommand)

		const restoredImage = document.body.querySelector(
			"img[data-original-path='images/inserted.png']",
		) as HTMLImageElement | null
		expect(restoredImage).toBeInstanceOf(HTMLImageElement)
		if (!restoredImage) throw new Error("Expected restored image to exist")
		expect(restoredImage.previousElementSibling).toBe(asyncInsertedSibling)

		asyncInsertedSibling.remove()
	})

	it("should keep DOM unchanged when floating image upload is cancelled", async () => {
		const originalImageCount = document.body.querySelectorAll("img").length
		const runPromise = imageManager.runImageAction({
			action: "insert-floating-image",
		})

		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "insert-floating-image",
			selector: "body",
			success: false,
			cancelled: true,
		})

		await expect(runPromise).resolves.toBeUndefined()
		expect(document.body.querySelectorAll("img")).toHaveLength(originalImageCount)
		expect(commandHistory.getUndoStackSize()).toBe(0)
	})

	it("should reject when floating image upload fails", async () => {
		const runPromise = imageManager.runImageAction({
			action: "insert-floating-image",
		})

		const [messagePayload] = postMessageSpy.mock.calls[0] as [
			{ type: string; data: ImageUploadRequestPayload },
			string,
		]
		const requestPayload = messagePayload.data

		imageManager.handleUploadResult({
			requestId: requestPayload.requestId,
			action: "insert-floating-image",
			selector: "body",
			success: false,
			error: "Insert upload failed",
		})

		await expect(runPromise).rejects.toThrow("Insert upload failed")
		expect(
			document.body.querySelector("img[data-original-path='images/inserted.png']"),
		).toBeNull()
		expect(commandHistory.getUndoStackSize()).toBe(0)
	})
})
