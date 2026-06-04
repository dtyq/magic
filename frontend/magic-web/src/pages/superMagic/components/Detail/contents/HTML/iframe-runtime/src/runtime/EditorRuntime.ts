/**
 * Editor Runtime
 * Main runtime class that orchestrates all editor functionality
 */

import { EditorBridge } from "../core/EditorBridge"
import { CommandHistory } from "../core/CommandHistory"
import { ElementSelector } from "../features/ElementSelector"
import { ImageManager } from "../managers/ImageManager"
import { DragDropManager } from "../managers/DragDropManager"
import { StyleManager } from "../managers/StyleManager"
import { TextStyleManager } from "../managers/TextStyleManager"
import { EditorLogger } from "../utils/EditorLogger"
import { isFromTrustedParent, getParentOrigin } from "../utils/parentOrigin"
import {
	registerRequestHandlers,
	registerCommandHandlers,
	registerSelectionHandlers,
} from "../handlers"
import { EventType } from "../core/types"

export class EditorRuntime {
	private bridge: EditorBridge
	private commandHistory: CommandHistory
	private styleManager: StyleManager
	private textStyleManager: TextStyleManager
	private elementSelector: ElementSelector
	private imageManager: ImageManager
	private dragDropManager: DragDropManager
	private isEditMode = false
	private keyboardShortcutHandler: ((event: KeyboardEvent) => Promise<void>) | null = null
	private wheelEventHandler: ((event: WheelEvent) => void) | null = null
	private imageUploadResultHandler: ((event: MessageEvent) => void) | null = null
	private dragDropMessageHandler: ((event: MessageEvent) => void) | null = null
	private nativeDragOverHandler: ((event: DragEvent) => void) | null = null
	private nativeDropHandler: ((event: DragEvent) => void) | null = null
	private nativeImageDropInProgress = false

	constructor() {
		EditorLogger.info("Initializing editor runtime")

		// Initialize modules
		this.commandHistory = new CommandHistory(50)
		this.bridge = new EditorBridge()
		this.styleManager = new StyleManager(this.commandHistory)
		this.textStyleManager = new TextStyleManager(this.commandHistory, this.bridge)
		this.elementSelector = new ElementSelector(this.bridge)
		this.imageManager = new ImageManager(this.commandHistory, this.elementSelector)
		this.dragDropManager = new DragDropManager(this.commandHistory, this.elementSelector)

		// Connect styleManager with elementSelector for undo/redo refresh
		this.styleManager.setElementSelector(this.elementSelector)

		// Connect styleManager with textStyleManager for text selection state management
		this.styleManager.setTextStyleManager(this.textStyleManager)

		this.styleManager.registerCommandHandler({
			canHandleCommand: (commandType) => this.imageManager.canHandleCommand(commandType),
			restoreCommand: (command) => this.imageManager.restoreCommand(command),
			applyCommand: (command) => this.imageManager.applyCommand(command),
		})

		this.styleManager.registerCommandHandler({
			canHandleCommand: (commandType) => this.dragDropManager.canHandleCommand(commandType),
			restoreCommand: (command) => {
				return this.dragDropManager.restoreCommand(command)
			},
			applyCommand: (command) => {
				return this.dragDropManager.applyCommand(command)
			},
		})

		// Connect textStyleManager with elementSelector for selecting created spans
		this.textStyleManager.setElementSelector(this.elementSelector)

		// Set text editing callback for double-click activation
		this.elementSelector.setTextEditingCallback((selector: string) => {
			this.styleManager.enableTextEditing(selector)
		})

		// Listen to history state changes
		this.commandHistory.setOnStateChange((state) => {
			this.bridge.sendEvent("HISTORY_STATE_CHANGED", state)
			this.notifyContentChanged()
		})

		// Register handlers
		this.registerHandlers()

		// Setup keyboard shortcuts
		this.setupKeyboardShortcuts()

		// Setup wheel handler for trackpad pinch-to-zoom
		this.setupWheelHandler()

		// Setup host upload result handler
		this.setupImageUploadResultHandler()

		// Setup drag-drop message handler
		this.setupDragDropMessageHandler()

		// Setup native iframe drag/drop handler
		this.setupNativeDragDropHandler()

		EditorLogger.info("Editor runtime initialized")

		// Notify parent window that runtime is ready
		this.bridge.sendEvent("EDITOR_READY", {
			timestamp: Date.now(),
			version: "1.0.0",
		})
	}

	/**
	 * Register all handlers
	 */
	private registerHandlers(): void {
		// Register request handlers
		registerRequestHandlers({
			bridge: this.bridge,
			commandHistory: this.commandHistory,
			styleManager: this.styleManager,
			textStyleManager: this.textStyleManager,
			elementSelector: this.elementSelector,
			onEditModeChange: (isEditMode: boolean) => {
				this.isEditMode = isEditMode
				this.notifyEditModeChanged()

				// Start/stop text selection monitoring based on edit mode
				if (isEditMode) {
					this.textStyleManager.startMonitoring()
				} else {
					this.textStyleManager.stopMonitoring()
				}
			},
			onSelectionModeChange: (isSelectionMode: boolean) => {
				this.notifySelectionModeChanged(isSelectionMode)
			},
		})

		// Register command handlers
		registerCommandHandlers({
			bridge: this.bridge,
			styleManager: this.styleManager,
			textStyleManager: this.textStyleManager,
			imageManager: this.imageManager,
		})

		// Register selection handlers
		registerSelectionHandlers({
			bridge: this.bridge,
		})
	}

	/**
	 * Setup keyboard shortcuts for undo/redo
	 */
	private setupKeyboardShortcuts(): void {
		this.keyboardShortcutHandler = async (event: KeyboardEvent) => {
			// Ignore if user is typing in an input/textarea/contenteditable
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				(event.target instanceof HTMLElement && event.target.isContentEditable)
			) {
				return
			}

			const isMac = navigator.platform.toUpperCase().includes("MAC")
			const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey

			// Cmd/Ctrl + Z for undo
			if (ctrlOrCmd && event.key === "z" && !event.shiftKey) {
				if (this.commandHistory.canUndo()) {
					event.preventDefault()
					const result = await this.styleManager.undo()
					EditorLogger.info("Undo triggered by keyboard shortcut", { success: result })
				}
				return
			}

			// Cmd/Ctrl + Shift + Z for redo
			// Also support Cmd/Ctrl + Y for redo on Windows/Linux
			if (
				(ctrlOrCmd && event.key === "z" && event.shiftKey) ||
				(ctrlOrCmd && event.key === "y" && !isMac)
			) {
				if (this.commandHistory.canRedo()) {
					event.preventDefault()
					const result = await this.styleManager.redo()
					EditorLogger.info("Redo triggered by keyboard shortcut", { success: result })
				}
			}
		}

		window.addEventListener("keydown", this.keyboardShortcutHandler)
		EditorLogger.info("Keyboard shortcuts registered for undo/redo")
	}

	/**
	 * Setup wheel handler for trackpad pinch-to-zoom gesture
	 */
	private setupWheelHandler(): void {
		this.wheelEventHandler = (event: WheelEvent) => {
			// Detect pinch gesture (Ctrl/Cmd + wheel on trackpad)
			if (event.ctrlKey || event.metaKey) {
				event.preventDefault()

				// Calculate scale delta based on wheel direction
				// Negative deltaY means zoom in, positive means zoom out
				const delta = -event.deltaY

				// Send zoom event to parent window
				this.bridge.sendEvent(EventType.IFRAME_ZOOM_REQUEST, {
					delta,
					timestamp: Date.now(),
				})
			}
		}

		window.addEventListener("wheel", this.wheelEventHandler, { passive: false })
		EditorLogger.info("Wheel handler registered for trackpad pinch-to-zoom")
	}

	private setupImageUploadResultHandler(): void {
		this.imageUploadResultHandler = (event: MessageEvent) => {
			if (!isFromTrustedParent(event)) return
			if (!event.data || event.data.type !== "IMAGE_UPLOAD_RESULT") return
			if (!event.data.data) return

			this.imageManager.handleUploadResult(event.data.data)
		}

		window.addEventListener("message", this.imageUploadResultHandler)
		EditorLogger.info("Image upload result handler registered")
	}

	/**
	 * Setup drag-drop message handler for parent → iframe communication
	 */
	private setupDragDropMessageHandler(): void {
		this.dragDropMessageHandler = (event: MessageEvent) => {
			if (!isFromTrustedParent(event)) return
			if (!event.data || !event.data.type) return

			switch (event.data.type) {
				case "DRAG_OVER_IMAGE": {
					if (!this.isEditMode) return
					const { x, y } = event.data.data || {}
					if (typeof x !== "number" || typeof y !== "number") return
					const result = this.dragDropManager.handleDragOver(x, y)
					// Send position response back to parent
					window.parent.postMessage(
						{
							type: "DRAG_POSITION_RESPONSE",
							data: result,
						},
						getParentOrigin(),
					)
					break
				}
				case "DRAG_LEAVE_IMAGE": {
					if (!this.isEditMode) return
					this.dragDropManager.handleDragLeave()
					break
				}
				case "DROP_IMAGE": {
					if (!this.isEditMode) return
					const { relativePath, previewUrl, x, y } = event.data.data || {}
					if (!relativePath) return
					const success = this.dragDropManager.insertImage(relativePath, previewUrl, x, y)
					if (success) {
						this.notifyContentChanged()
					}
					break
				}
			}
		}

		window.addEventListener("message", this.dragDropMessageHandler)
		EditorLogger.info("Drag-drop message handler registered")
	}

	private setupNativeDragDropHandler(): void {
		this.nativeDragOverHandler = (event: DragEvent) => {
			if (!this.isEditMode) return
			if (isImageFileDrag(event)) {
				event.preventDefault()
				event.stopPropagation()
				if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
				this.dragDropManager.handleDragOver(event.clientX, event.clientY)
			}
		}

		this.nativeDropHandler = async (event: DragEvent) => {
			if (!this.isEditMode) return
			if (!isImageFileDrag(event)) return

			event.preventDefault()
			event.stopPropagation()

			const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
				item.type.startsWith("image/"),
			)

			if (!file) {
				this.dragDropManager.handleDragLeave()
				return
			}

			if (this.nativeImageDropInProgress) {
				this.dragDropManager.handleDragLeave()
				return
			}

			try {
				this.nativeImageDropInProgress = true
				const previewUrl = await fileToDataUrl(file)
				const uploadResult = await uploadDroppedImageFile(file)
				const relativePath =
					getUploadedRelativePath(uploadResult) || `./images/${file.name}`
				const success = this.dragDropManager.insertImage(
					relativePath,
					previewUrl,
					event.clientX,
					event.clientY,
				)
				if (success) this.notifyContentChanged()
			} catch (error) {
				this.dragDropManager.handleDragLeave()
				EditorLogger.warn("Native iframe image drop failed", error)
			} finally {
				this.nativeImageDropInProgress = false
			}
		}

		document.addEventListener("dragover", this.nativeDragOverHandler)
		document.addEventListener("drop", this.nativeDropHandler)
	}

	/**
	 * Notify content changed
	 */
	private notifyContentChanged(): void {
		const payload = {
			hasChanges: this.commandHistory.getUndoStackSize() > 0,
			changeCount: this.commandHistory.getUndoStackSize(),
		}
		this.bridge.sendEvent("CONTENT_CHANGED", payload)
	}

	/**
	 * Notify edit mode changed
	 */
	private notifyEditModeChanged(): void {
		const payload = {
			isEditMode: this.isEditMode,
		}
		this.bridge.sendEvent("EDIT_MODE_CHANGED", payload)
	}

	/**
	 * Notify selection mode changed
	 */
	private notifySelectionModeChanged(isSelectionMode: boolean): void {
		const payload = {
			isSelectionMode,
		}
		this.bridge.sendEvent("SELECTION_MODE_CHANGED", payload)
	}

	/**
	 * Destroy runtime
	 */
	destroy(): void {
		EditorLogger.info("Destroy editor runtime")

		// Remove keyboard shortcut handler
		if (this.keyboardShortcutHandler) {
			window.removeEventListener("keydown", this.keyboardShortcutHandler)
			this.keyboardShortcutHandler = null
		}

		// Remove wheel event handler
		if (this.wheelEventHandler) {
			window.removeEventListener("wheel", this.wheelEventHandler)
			this.wheelEventHandler = null
		}

		if (this.imageUploadResultHandler) {
			window.removeEventListener("message", this.imageUploadResultHandler)
			this.imageUploadResultHandler = null
		}

		if (this.dragDropMessageHandler) {
			window.removeEventListener("message", this.dragDropMessageHandler)
			this.dragDropMessageHandler = null
		}

		if (this.nativeDragOverHandler) {
			document.removeEventListener("dragover", this.nativeDragOverHandler)
			this.nativeDragOverHandler = null
		}

		if (this.nativeDropHandler) {
			document.removeEventListener("drop", this.nativeDropHandler)
			this.nativeDropHandler = null
		}

		this.dragDropManager.destroy()
		this.imageManager.destroy()
		this.elementSelector.destroy()
		this.bridge.destroy()

		// Clear injection flag
		if (typeof window !== "undefined" && (window as any).__EDITING_FEATURES_V2_INJECTED__) {
			delete (window as any).__EDITING_FEATURES_V2_INJECTED__
		}
	}
}

function isImageFileDrag(event: DragEvent): boolean {
	const dataTransfer = event.dataTransfer
	if (!Array.from(dataTransfer?.types ?? []).includes("Files")) return false

	const items = Array.from(dataTransfer?.items ?? [])
	if (items.length > 0) {
		return items.some((item) => item.kind === "file" && item.type.startsWith("image/"))
	}

	const files = Array.from(dataTransfer?.files ?? [])
	if (files.length > 0) {
		return files.some((file) => file.type.startsWith("image/") || isImageFileName(file.name))
	}

	return false
}

function isImageFileName(fileName: string): boolean {
	return /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(fileName)
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(new Error("File read failed"))
		reader.readAsDataURL(file)
	})
}

async function uploadDroppedImageFile(file: File): Promise<unknown> {
	const uploadFiles = window.Magic?.project?.uploadFiles ?? window.Magic?.uploadFiles
	if (!uploadFiles) throw new Error("Magic uploadFiles API is unavailable")

	return uploadFiles([
		{
			file,
			path: `./images/${file.name}`,
			filename: file.name,
		},
	])
}

function getUploadedRelativePath(uploadResult: unknown): string | undefined {
	if (!Array.isArray(uploadResult)) return undefined
	const [firstResult] = uploadResult
	if (!firstResult || typeof firstResult !== "object") return undefined

	const relativeFilePath = (firstResult as { relative_file_path?: unknown }).relative_file_path
	const storedRelativeFilePath = (firstResult as { stored_relative_file_path?: unknown })
		.stored_relative_file_path
	if (typeof storedRelativeFilePath === "string" && storedRelativeFilePath) {
		return storedRelativeFilePath
	}
	return typeof relativeFilePath === "string" && relativeFilePath ? relativeFilePath : undefined
}
