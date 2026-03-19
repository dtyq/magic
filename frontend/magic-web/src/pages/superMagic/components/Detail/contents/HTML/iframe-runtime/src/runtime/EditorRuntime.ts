/**
 * Editor Runtime
 * Main runtime class that orchestrates all editor functionality
 */

import { EditorBridge } from "../core/EditorBridge"
import { CommandHistory } from "../core/CommandHistory"
import { ElementSelector } from "../features/ElementSelector"
import { StyleManager } from "../managers/StyleManager"
import { TextStyleManager } from "../managers/TextStyleManager"
import { EditorLogger } from "../utils/EditorLogger"
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
	private isEditMode = false
	private keyboardShortcutHandler: ((event: KeyboardEvent) => Promise<void>) | null = null
	private wheelEventHandler: ((event: WheelEvent) => void) | null = null

	constructor() {
		EditorLogger.info("Initializing editor runtime")

		// Initialize modules
		this.commandHistory = new CommandHistory(50)
		this.bridge = new EditorBridge()
		this.styleManager = new StyleManager(this.commandHistory)
		this.textStyleManager = new TextStyleManager(this.commandHistory, this.bridge)
		this.elementSelector = new ElementSelector(this.bridge)

		// Connect styleManager with elementSelector for undo/redo refresh
		this.styleManager.setElementSelector(this.elementSelector)

		// Connect styleManager with textStyleManager for text selection state management
		this.styleManager.setTextStyleManager(this.textStyleManager)

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

		this.elementSelector.destroy()
		this.bridge.destroy()

		// Clear injection flag
		if (typeof window !== "undefined" && (window as any).__EDITING_FEATURES_V2_INJECTED__) {
			delete (window as any).__EDITING_FEATURES_V2_INJECTED__
		}
	}
}
