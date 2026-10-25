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
import { DomStructureManager } from "../managers/DomStructureManager"
import { PPTBuildManager, type PPTBuildUpdate } from "../managers/PPTBuildManager"
import { PPTBuildMarkers } from "../features/PPTBuildMarkers"
import { PPTBuildPreview } from "../features/PPTBuildPreview"
import { EditorLogger } from "../utils/EditorLogger"
import { isFromTrustedParent, getParentOrigin } from "../utils/parentOrigin"
import {
	registerRequestHandlers,
	registerCommandHandlers,
	registerSelectionHandlers,
} from "../handlers"
import { EventType } from "../core/types"
import { KEYBOARD_MESSAGE_TYPES } from "../utils/hostKeyboardMessages"

export class EditorRuntime {
	private bridge: EditorBridge
	private commandHistory: CommandHistory
	private styleManager: StyleManager
	private textStyleManager: TextStyleManager
	private domStructureManager: DomStructureManager
	private elementSelector: ElementSelector
	private imageManager: ImageManager
	private dragDropManager: DragDropManager
	private pptBuildManager: PPTBuildManager
	private pptBuildMarkers = new PPTBuildMarkers()
	private pptBuildPreview = new PPTBuildPreview()
	private isEditMode = false
	private isPPTBuildMode = false
	private keyboardShortcutHandler: ((event: KeyboardEvent) => Promise<void>) | null = null
	private hostShortcutHandler: ((event: KeyboardEvent) => void) | null = null
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
		this.pptBuildManager = new PPTBuildManager(
			this.commandHistory,
			() => this.isEditMode || this.isPPTBuildMode,
		)
		this.textStyleManager = new TextStyleManager(this.commandHistory, this.bridge)
		this.elementSelector = new ElementSelector(this.bridge)
		this.domStructureManager = new DomStructureManager(
			this.commandHistory,
			this.elementSelector,
		)
		this.imageManager = new ImageManager(this.commandHistory, this.elementSelector)
		this.dragDropManager = new DragDropManager(this.commandHistory, this.elementSelector)
		this.styleManager.registerCommandHandler({
			canHandleCommand: (type) => this.pptBuildManager.canHandleCommand(type),
			restoreCommand: (command) => {
				const restored = this.pptBuildManager.restoreCommand(command)
				if (restored) this.elementSelector.refreshSelection()
				return restored
			},
			applyCommand: (command) => {
				const applied = this.pptBuildManager.applyCommand(command)
				if (applied) this.elementSelector.refreshSelection()
				return applied
			},
		})

		// Connect styleManager with elementSelector for undo/redo refresh
		this.styleManager.setElementSelector(this.elementSelector)

		// Connect styleManager with textStyleManager for text selection state management
		this.styleManager.setTextStyleManager(this.textStyleManager)
		this.styleManager.registerCommandHandler({
			canHandleCommand: (commandType) =>
				this.domStructureManager.canHandleCommand(commandType),
			restoreCommand: (command) => this.domStructureManager.restoreCommand(command),
			applyCommand: (command) => this.domStructureManager.applyCommand(command),
		})

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
			if (this.isEditMode) this.styleManager.enableTextEditing(selector)
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

		// Forward save/exit shortcuts to the host without rewriting the user document
		this.setupHostShortcutForwarding()

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
	private clearPPTBuildPreview(): void {
		this.pptBuildPreview.clear()
		this.pptBuildMarkers.setSuspended(false)
	}

	private registerHandlers(): void {
		// Animation configuration only selects source elements. It must never enable
		// text editing, element manipulation shortcuts, or the full editor's tools.
		this.bridge.onRequest("SET_PPT_BUILD_MODE", (payload) => {
			const enabled = (payload as { enabled?: unknown })?.enabled
			if (typeof enabled !== "boolean") throw new Error("PPT_BUILD_INVALID")
			this.isPPTBuildMode = enabled
			this.elementSelector.setSelectionOnly(enabled && !this.isEditMode)
			if (enabled) this.elementSelector.enable()
			else if (!this.isEditMode) this.elementSelector.disable()
			if (!enabled) {
				this.pptBuildMarkers.destroy()
				this.clearPPTBuildPreview()
			}
			this.notifySelectionModeChanged(enabled || this.isEditMode)
			return { success: true }
		})
		this.bridge.onRequest("GET_PPT_BUILDS", () => this.pptBuildManager.getBuilds())
		this.bridge.onCommand("UPDATE_PPT_BUILDS", (payload) => {
			this.pptBuildManager.updateBuilds((payload as { updates: PPTBuildUpdate[] })?.updates)
			// A stale preview would show the old step layout.
			this.clearPPTBuildPreview()
			this.elementSelector.refreshSelection()
			return { success: true }
		})
		this.bridge.onRequest("PREVIEW_PPT_BUILD", (payload) => {
			const steps = (payload as { steps?: unknown })?.steps
			if (steps === null) {
				this.clearPPTBuildPreview()
				return { success: true }
			}
			if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 0)
				throw new Error("PPT_BUILD_INVALID")
			if (!this.isEditMode && !this.isPPTBuildMode)
				throw new Error("PPT_BUILD_EDIT_MODE_REQUIRED")
			this.pptBuildPreview.show(steps, (payload as { animate?: unknown })?.animate === true)
			// A preview should look like the presentation, without the authoring overlay.
			this.pptBuildMarkers.setSuspended(true)
			return { success: true }
		})
		this.bridge.onRequest("SET_PPT_BUILD_MARKERS", (payload) => {
			const visible = (payload as { visible?: unknown })?.visible
			if (typeof visible !== "boolean") throw new Error("PPT_BUILD_INVALID")
			if (visible && !this.isEditMode && !this.isPPTBuildMode)
				throw new Error("PPT_BUILD_EDIT_MODE_REQUIRED")
			this.pptBuildMarkers.setVisible(visible)
			return { success: true }
		})
		// Register request handlers
		registerRequestHandlers({
			bridge: this.bridge,
			commandHistory: this.commandHistory,
			styleManager: this.styleManager,
			textStyleManager: this.textStyleManager,
			elementSelector: this.elementSelector,
			domStructureManager: this.domStructureManager,
			onEditModeChange: (isEditMode: boolean) => {
				this.isEditMode = isEditMode
				this.elementSelector.setSelectionOnly(this.isPPTBuildMode && !isEditMode)
				this.notifyEditModeChanged()

				// Start/stop text selection monitoring based on edit mode
				if (isEditMode) {
					this.textStyleManager.startMonitoring()
				} else {
					this.pptBuildMarkers.destroy()
					this.clearPPTBuildPreview()
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
			domStructureManager: this.domStructureManager,
		})

		// Register selection handlers
		registerSelectionHandlers({
			bridge: this.bridge,
		})
	}

	/**
	 * Setup keyboard shortcuts for editor-only commands.
	 */
	private setupKeyboardShortcuts(): void {
		this.keyboardShortcutHandler = async (event: KeyboardEvent) => {
			const isMac = navigator.platform.toUpperCase().includes("MAC")
			// Support both Ctrl and Cmd so shortcuts stay consistent with the host editor.
			const ctrlOrCmd = event.metaKey || event.ctrlKey

			// Keep browser/page shortcuts untouched until the editor is explicitly active.
			if (!this.isEditMode) {
				return
			}

			// Let native inputs and active text editing keep their own keyboard behavior.
			if (isEditableShortcutTarget(event.target)) {
				return
			}

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
				return
			}

			// Delete / Backspace removes the currently selected element in edit mode.
			if (event.key === "Delete" || event.key === "Backspace") {
				const [selectedSelector] = this.elementSelector.getSelectedSelectors()
				if (selectedSelector) {
					event.preventDefault()
					await this.styleManager.deleteElement(selectedSelector)
					EditorLogger.info("Delete triggered by keyboard shortcut", {
						selector: selectedSelector,
					})
				}
				return
			}

			// Cmd/Ctrl + D duplicates the selected element and suppresses browser bookmarks.
			if (ctrlOrCmd && event.key.toLowerCase() === "d" && !event.shiftKey && !event.altKey) {
				const [selectedSelector] = this.elementSelector.getSelectedSelectors()
				if (selectedSelector) {
					event.preventDefault()
					await this.styleManager.duplicateElement(selectedSelector)
					EditorLogger.info("Duplicate triggered by keyboard shortcut", {
						selector: selectedSelector,
					})
				}
			}
		}

		window.addEventListener("keydown", this.keyboardShortcutHandler)
		EditorLogger.info("Keyboard shortcuts registered for undo/redo/delete/duplicate")
	}

	/**
	 * Forward Cmd/Ctrl+S, Shift+Cmd/Ctrl+S and Escape to the host editor.
	 *
	 * These used to be a <script> injected into the user's HTML when edit mode
	 * started. That changed the document content, so the preview was rewritten in
	 * place (document.open/write in the same Window) and page scripts with
	 * top-level let/const/class failed to re-run, leaving scroll-reveal content
	 * invisible. Installing the listener from the runtime keeps the document
	 * untouched, so entering edit mode causes no reload and no flicker.
	 *
	 * Capture phase on document, so page handlers and text editing cannot swallow
	 * the shortcut. The message shape matches the host's createKeyboardMessageHandler.
	 */
	private setupHostShortcutForwarding(): void {
		this.hostShortcutHandler = (event: KeyboardEvent) => {
			if (!this.isEditMode) return

			const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
			const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey

			// event.key is "S" while Shift is held (and with Caps Lock), so compare case-insensitively.
			// Not event.code: it is the physical key and breaks Cmd+S on non-QWERTY layouts.
			if (ctrlOrCmd && event.key.toLowerCase() === "s") {
				event.preventDefault()
				event.stopPropagation()
				window.parent.postMessage(
					{
						type: event.shiftKey
							? KEYBOARD_MESSAGE_TYPES.SAVE_AND_EXIT
							: KEYBOARD_MESSAGE_TYPES.SAVE,
						source: KEYBOARD_MESSAGE_TYPES.SOURCE,
					},
					getParentOrigin(),
				)
				return
			}

			if (event.key === "Escape") {
				event.preventDefault()
				// Keep the iframe selection active while the host closes its local panel.
				event.stopImmediatePropagation()
				window.parent.postMessage(
					{
						type: KEYBOARD_MESSAGE_TYPES.CANCEL,
						source: KEYBOARD_MESSAGE_TYPES.SOURCE,
					},
					getParentOrigin(),
				)
			}
		}

		document.addEventListener("keydown", this.hostShortcutHandler, true)
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
		this.pptBuildMarkers.destroy()
		this.clearPPTBuildPreview()

		// Remove keyboard shortcut handler
		if (this.keyboardShortcutHandler) {
			window.removeEventListener("keydown", this.keyboardShortcutHandler)
			this.keyboardShortcutHandler = null
		}

		if (this.hostShortcutHandler) {
			document.removeEventListener("keydown", this.hostShortcutHandler, true)
			this.hostShortcutHandler = null
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

/**
 * Detects targets that should keep native typing and editing shortcuts.
 */
function isEditableShortcutTarget(target: EventTarget | null): boolean {
	// Host-level shortcuts must not override typing or inline text editing.
	if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
	if (!(target instanceof HTMLElement)) return false

	const isRuntimeTextEditing =
		target.getAttribute("data-text-editing") === "true" ||
		target.closest('[data-text-editing="true"]') !== null
	const isNativeEditable =
		target.isContentEditable || target.closest('[contenteditable="true"]') !== null

	return isRuntimeTextEditing || isNativeEditable
}
