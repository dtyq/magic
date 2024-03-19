/**
 * Command History Manager
 * Manages undo/redo stack for commands
 */

import type { CommandRecord, HistoryState } from "./types"

export class CommandHistory {
	private undoStack: CommandRecord[] = []
	private redoStack: CommandRecord[] = []
	private maxSize: number
	private onStateChange?: (state: HistoryState) => void
	private batchMode = false
	private batchStartCommand: CommandRecord | null = null

	constructor(maxSize = 50) {
		this.maxSize = maxSize
	}

	setOnStateChange(callback: (state: HistoryState) => void): void {
		this.onStateChange = callback
	}

	push(command: CommandRecord) {
		// Skip recording commands during batch mode
		// Commands will be recorded as a single batch command in endBatch()
		if (this.batchMode) {
			return
		}

		this.undoStack.push(command)
		if (this.undoStack.length > this.maxSize) {
			this.undoStack.shift()
		}
		// Clear redo stack when new command is added
		this.redoStack = []
		this.notifyStateChange()
	}

	undo(): CommandRecord | null {
		if (this.undoStack.length === 0) return null
		const command = this.undoStack.pop()!
		this.redoStack.push(command)
		this.notifyStateChange()
		return command
	}

	redo(): CommandRecord | null {
		if (this.redoStack.length === 0) return null
		const command = this.redoStack.pop()!
		this.undoStack.push(command)
		this.notifyStateChange()
		return command
	}

	canUndo(): boolean {
		return this.undoStack.length > 0
	}

	canRedo(): boolean {
		return this.redoStack.length > 0
	}

	getState(): HistoryState {
		return {
			canUndo: this.canUndo(),
			canRedo: this.canRedo(),
			currentIndex: this.undoStack.length,
			totalCommands: this.undoStack.length + this.redoStack.length,
			undoStack: this.undoStack.map((cmd) => ({
				description: cmd.metadata?.description || "Unknown",
				timestamp: cmd.timestamp,
			})),
			redoStack: this.redoStack.map((cmd) => ({
				description: cmd.metadata?.description || "Unknown",
				timestamp: cmd.timestamp,
			})),
		}
	}

	clear() {
		this.undoStack = []
		this.redoStack = []
		this.notifyStateChange()
	}

	getUndoStackSize(): number {
		return this.undoStack.length
	}

	getRedoStackSize(): number {
		return this.redoStack.length
	}

	private notifyStateChange(): void {
		if (this.onStateChange) {
			this.onStateChange(this.getState())
		}
	}

	/**
	 * Begin batch operation
	 * During batch mode, commands are not recorded to history
	 */
	beginBatch(initialCommand: CommandRecord): void {
		this.batchMode = true
		this.batchStartCommand = initialCommand
	}

	/**
	 * End batch operation
	 * Records the batch as a single command in history
	 */
	endBatch(finalCommand: CommandRecord): void {
		if (!this.batchMode || !this.batchStartCommand) {
			return
		}

		// Create a single command that represents the entire batch operation
		const batchCommand: CommandRecord = {
			...finalCommand,
			// Use initial state as previous state
			previousState: this.batchStartCommand.previousState,
			timestamp: Date.now(),
		}

		// Reset batch state BEFORE pushing to allow the command to be recorded
		this.batchMode = false
		this.batchStartCommand = null

		// Record the batch command to history
		this.push(batchCommand)
	}

	/**
	 * Cancel batch operation without recording
	 */
	cancelBatch(): void {
		this.batchMode = false
		this.batchStartCommand = null
	}

	/**
	 * Check if in batch mode
	 */
	isInBatchMode(): boolean {
		return this.batchMode
	}
}
