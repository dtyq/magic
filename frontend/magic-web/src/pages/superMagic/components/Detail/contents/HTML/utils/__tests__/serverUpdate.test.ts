import { describe, expect, it, vi } from "vitest"
import {
	attemptHtmlSaveFlow,
	confirmHtmlConflictSave,
	resolveServerUpdateState,
	shouldPromptForServerUpdate,
} from "../index"

describe("server-update", () => {
	describe("shouldPromptForServerUpdate", () => {
		it("should not prompt when server content matches the edit-session baseline", () => {
			const result = shouldPromptForServerUpdate({
				latestContent: "<div>same</div>",
				sessionBaselineContent: "<div>same</div>",
			})

			expect(result).toBe(false)
		})

		it("should not prompt when server content matches latest local saved content", () => {
			const result = shouldPromptForServerUpdate({
				latestContent: "<div>saved</div>",
				sessionBaselineContent: "<div>baseline</div>",
				lastLocalSavedContent: "<div>saved</div>",
			})

			expect(result).toBe(false)
		})

		it("should prompt when server content differs from both baseline and local-save marker", () => {
			const result = shouldPromptForServerUpdate({
				latestContent: "<div>server</div>",
				sessionBaselineContent: "<div>baseline</div>",
				lastLocalSavedContent: "<div>saved</div>",
			})

			expect(result).toBe(true)
		})
	})

	describe("resolveServerUpdateState", () => {
		it("should clear the local-save marker after consuming a matching server refresh", () => {
			const result = resolveServerUpdateState({
				latestContent: "<div>saved</div>",
				sessionBaselineContent: "<div>baseline</div>",
				lastLocalSavedContent: "<div>saved</div>",
			})

			expect(result.shouldPrompt).toBe(false)
			expect(result.nextLastLocalSavedContent).toBeNull()
		})

		it("should keep the local-save marker when the latest server content is unrelated", () => {
			const result = resolveServerUpdateState({
				latestContent: "<div>server</div>",
				sessionBaselineContent: "<div>baseline</div>",
				lastLocalSavedContent: "<div>saved</div>",
			})

			expect(result.shouldPrompt).toBe(true)
			expect(result.nextLastLocalSavedContent).toBe("<div>saved</div>")
		})

		it("should not prompt when the latest server content still matches the original session baseline", () => {
			const result = resolveServerUpdateState({
				latestContent: "<div>baseline</div>",
				sessionBaselineContent: "<div>baseline</div>",
				lastLocalSavedContent: null,
			})

			expect(result.shouldPrompt).toBe(false)
			expect(result.nextLastLocalSavedContent).toBeNull()
		})
	})

	describe("attemptHtmlSaveFlow", () => {
		it("should defer save and open confirm dialog when a latest conflict is detected", async () => {
			const showConflictDialog = vi.fn()
			const performSave = vi.fn()
			const exitEditMode = vi.fn()

			const result = await attemptHtmlSaveFlow({
				shouldExitAfterSave: true,
				refreshServerUpdateState: async () => true,
				showConflictDialog,
				checkServerUpdateBeforeSave: () => true,
				performSave,
				exitEditMode,
			})

			expect(result).toEqual({
				didSave: false,
				isAwaitingConflictConfirmation: true,
			})
			expect(showConflictDialog).toHaveBeenCalledTimes(1)
			expect(performSave).not.toHaveBeenCalled()
			expect(exitEditMode).not.toHaveBeenCalled()
		})

		it("should save and exit immediately when no conflict is detected", async () => {
			const performSave = vi.fn(async () => undefined)
			const exitEditMode = vi.fn()

			const result = await attemptHtmlSaveFlow({
				shouldExitAfterSave: true,
				refreshServerUpdateState: async () => false,
				showConflictDialog: vi.fn(),
				checkServerUpdateBeforeSave: () => true,
				performSave,
				exitEditMode,
			})

			expect(result).toEqual({
				didSave: true,
				isAwaitingConflictConfirmation: false,
			})
			expect(performSave).toHaveBeenCalledTimes(1)
			expect(exitEditMode).toHaveBeenCalledTimes(1)
		})
	})

	describe("confirmHtmlConflictSave", () => {
		it("should preserve save-and-exit intent after conflict confirmation", async () => {
			const performSave = vi.fn(async () => undefined)
			const exitEditMode = vi.fn()

			await confirmHtmlConflictSave({
				shouldExitAfterSave: true,
				performSave,
				exitEditMode,
			})

			expect(performSave).toHaveBeenCalledTimes(1)
			expect(exitEditMode).toHaveBeenCalledTimes(1)
		})
	})
})
