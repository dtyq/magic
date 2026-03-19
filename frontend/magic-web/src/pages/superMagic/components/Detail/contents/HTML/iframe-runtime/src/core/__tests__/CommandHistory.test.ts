/**
 * CommandHistory tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { CommandHistory } from "../CommandHistory"
import type { CommandRecord } from "../types"

describe("CommandHistory", () => {
	let history: CommandHistory

	beforeEach(() => {
		history = new CommandHistory(3) // Use small max size for testing
	})

	const createCommand = (description: string): CommandRecord => ({
		commandType: "test",
		payload: { value: description },
		timestamp: Date.now(),
		metadata: { description, canUndo: true },
	})

	describe("push", () => {
		it("should add command to undo stack", () => {
			const cmd = createCommand("test")
			history.push(cmd)
			expect(history.canUndo()).toBe(true)
			expect(history.getUndoStackSize()).toBe(1)
		})

		it("should clear redo stack when new command is pushed", () => {
			const cmd1 = createCommand("cmd1")
			const cmd2 = createCommand("cmd2")
			history.push(cmd1)
			history.undo()
			expect(history.canRedo()).toBe(true)

			history.push(cmd2)
			expect(history.canRedo()).toBe(false)
			expect(history.getRedoStackSize()).toBe(0)
		})

		it("should respect max size limit", () => {
			for (let i = 0; i < 5; i++) {
				history.push(createCommand(`cmd${i}`))
			}
			expect(history.getUndoStackSize()).toBe(3) // maxSize is 3
		})

		it("should trigger state change callback", () => {
			const callback = vi.fn()
			history.setOnStateChange(callback)
			history.push(createCommand("test"))
			expect(callback).toHaveBeenCalledTimes(1)
		})
	})

	describe("undo", () => {
		it("should return null when nothing to undo", () => {
			expect(history.undo()).toBeNull()
		})

		it("should move command from undo to redo stack", () => {
			const cmd = createCommand("test")
			history.push(cmd)
			const undoCmd = history.undo()

			expect(undoCmd).toBe(cmd)
			expect(history.getUndoStackSize()).toBe(0)
			expect(history.getRedoStackSize()).toBe(1)
		})

		it("should allow multiple undos", () => {
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))

			expect(history.undo()).toBeTruthy()
			expect(history.undo()).toBeTruthy()
			expect(history.canUndo()).toBe(false)
		})

		it("should trigger state change callback", () => {
			const callback = vi.fn()
			history.setOnStateChange(callback)
			history.push(createCommand("test"))
			callback.mockClear()

			history.undo()
			expect(callback).toHaveBeenCalledTimes(1)
		})
	})

	describe("redo", () => {
		it("should return null when nothing to redo", () => {
			expect(history.redo()).toBeNull()
		})

		it("should move command from redo to undo stack", () => {
			const cmd = createCommand("test")
			history.push(cmd)
			history.undo()

			const redoCmd = history.redo()
			expect(redoCmd).toBe(cmd)
			expect(history.getUndoStackSize()).toBe(1)
			expect(history.getRedoStackSize()).toBe(0)
		})

		it("should allow multiple redos", () => {
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))
			history.undo()
			history.undo()

			expect(history.redo()).toBeTruthy()
			expect(history.redo()).toBeTruthy()
			expect(history.canRedo()).toBe(false)
		})

		it("should trigger state change callback", () => {
			const callback = vi.fn()
			history.setOnStateChange(callback)
			history.push(createCommand("test"))
			history.undo()
			callback.mockClear()

			history.redo()
			expect(callback).toHaveBeenCalledTimes(1)
		})
	})

	describe("canUndo", () => {
		it("should return false for empty history", () => {
			expect(history.canUndo()).toBe(false)
		})

		it("should return true when commands exist", () => {
			history.push(createCommand("test"))
			expect(history.canUndo()).toBe(true)
		})

		it("should return false after undoing all commands", () => {
			history.push(createCommand("test"))
			history.undo()
			expect(history.canUndo()).toBe(false)
		})
	})

	describe("canRedo", () => {
		it("should return false for empty redo stack", () => {
			expect(history.canRedo()).toBe(false)
		})

		it("should return true after undo", () => {
			history.push(createCommand("test"))
			history.undo()
			expect(history.canRedo()).toBe(true)
		})

		it("should return false after new command is pushed", () => {
			history.push(createCommand("cmd1"))
			history.undo()
			history.push(createCommand("cmd2"))
			expect(history.canRedo()).toBe(false)
		})
	})

	describe("getState", () => {
		it("should return correct state for empty history", () => {
			const state = history.getState()
			expect(state.canUndo).toBe(false)
			expect(state.canRedo).toBe(false)
			expect(state.currentIndex).toBe(0)
			expect(state.totalCommands).toBe(0)
		})

		it("should return correct state with commands", () => {
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))

			const state = history.getState()
			expect(state.canUndo).toBe(true)
			expect(state.canRedo).toBe(false)
			expect(state.currentIndex).toBe(2)
			expect(state.totalCommands).toBe(2)
		})

		it("should include undo stack descriptions", () => {
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))

			const state = history.getState()
			expect(state.undoStack).toHaveLength(2)
			expect(state.undoStack[0].description).toBe("cmd1")
			expect(state.undoStack[1].description).toBe("cmd2")
		})

		it("should include redo stack descriptions", () => {
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))
			history.undo()

			const state = history.getState()
			expect(state.redoStack).toHaveLength(1)
			expect(state.redoStack[0].description).toBe("cmd2")
		})
	})

	describe("clear", () => {
		it("should clear both stacks", () => {
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))
			history.undo()

			history.clear()

			expect(history.canUndo()).toBe(false)
			expect(history.canRedo()).toBe(false)
			expect(history.getUndoStackSize()).toBe(0)
			expect(history.getRedoStackSize()).toBe(0)
		})

		it("should trigger state change callback", () => {
			const callback = vi.fn()
			history.setOnStateChange(callback)
			history.push(createCommand("test"))
			callback.mockClear()

			history.clear()
			expect(callback).toHaveBeenCalledTimes(1)
		})
	})

	describe("batch operations", () => {
		it("should enter batch mode", () => {
			const cmd = createCommand("initial")
			history.beginBatch(cmd)
			expect(history.isInBatchMode()).toBe(true)
		})

		it("should exit batch mode and record single command", () => {
			const initialCmd = createCommand("initial")
			const finalCmd = createCommand("final")

			history.beginBatch(initialCmd)
			// In batch mode, commands are not recorded
			history.endBatch(finalCmd)

			expect(history.isInBatchMode()).toBe(false)
			expect(history.getUndoStackSize()).toBe(1)
		})

		it("should use initial state as previous state", () => {
			const initialCmd = createCommand("initial")
			initialCmd.previousState = { value: "old" }
			const finalCmd = createCommand("final")
			finalCmd.previousState = { value: "intermediate" }

			history.beginBatch(initialCmd)
			const callback = vi.fn()
			history.setOnStateChange(callback)
			history.endBatch(finalCmd)

			// The recorded command should have initial state
			const recorded = history.undo()
			expect(recorded?.previousState).toEqual({ value: "old" })
		})

		it("should cancel batch without recording", () => {
			const cmd = createCommand("initial")
			history.beginBatch(cmd)
			history.cancelBatch()

			expect(history.isInBatchMode()).toBe(false)
			expect(history.getUndoStackSize()).toBe(0)
		})

		it("should handle endBatch without beginBatch", () => {
			const cmd = createCommand("test")
			history.endBatch(cmd)
			// Should not crash, but also should not record
			expect(history.getUndoStackSize()).toBe(0)
		})

		it("should ignore push commands during batch mode", () => {
			const initialCmd = createCommand("initial")
			history.beginBatch(initialCmd)

			// Try to push commands during batch mode
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))

			// Commands should be ignored during batch mode
			expect(history.getUndoStackSize()).toBe(0)
			expect(history.isInBatchMode()).toBe(true)

			// End batch
			const finalCmd = createCommand("final")
			history.endBatch(finalCmd)

			// Only the batch command should be recorded
			expect(history.getUndoStackSize()).toBe(1)
			expect(history.isInBatchMode()).toBe(false)
		})
	})

	describe("edge cases", () => {
		it("should handle command without metadata", () => {
			const cmd: CommandRecord = {
				commandType: "test",
				payload: {},
				timestamp: Date.now(),
			}
			history.push(cmd)

			const state = history.getState()
			expect(state.undoStack[0].description).toBe("Unknown")
		})

		it("should handle large number of commands", () => {
			const largeHistory = new CommandHistory(1000)
			for (let i = 0; i < 500; i++) {
				largeHistory.push(createCommand(`cmd${i}`))
			}
			expect(largeHistory.getUndoStackSize()).toBe(500)
		})

		it("should handle rapid undo/redo", () => {
			history.push(createCommand("cmd1"))
			history.push(createCommand("cmd2"))

			for (let i = 0; i < 10; i++) {
				history.undo()
				history.redo()
			}

			expect(history.getUndoStackSize()).toBe(2)
			expect(history.getRedoStackSize()).toBe(0)
		})
	})
})
