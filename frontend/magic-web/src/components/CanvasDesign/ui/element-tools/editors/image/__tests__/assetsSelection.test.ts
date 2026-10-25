import { describe, expect, it, vi } from "vitest"
import type { CanvasAssetImportResult } from "../../../../../runtime/resources/asset/CanvasAssetImportManager"
import { applyImportedAssetsToImageSlots } from "../assetsSelection"

function createImported(assetId: string): CanvasAssetImportResult {
	return {
		elementId: `${assetId}-element`,
		connectionId: `${assetId}-connection`,
		workspacePath: `./images/${assetId}.png`,
		fileName: `${assetId}.png`,
		mediaType: "image",
		source: "downloaded",
	}
}

describe("applyImportedAssetsToImageSlots", () => {
	it("replaces the selected slot and appends following assets in selection order", () => {
		const replaceReferenceFileAt = vi.fn()

		applyImportedAssetsToImageSlots({
			slot: { slotIndex: 1, path: "./images/old.png" },
			currentReferenceFileCount: 2,
			imported: [createImported("first"), createImported("second")],
			handlers: { replaceReferenceFileAt },
		})

		expect(replaceReferenceFileAt).toHaveBeenNthCalledWith(
			1,
			1,
			{
				path: "./images/first.png",
				src: "./images/first.png",
				fileName: "first.png",
			},
			{ ensurePromptMention: true, retainReferenceSlot: true },
		)
		expect(replaceReferenceFileAt).toHaveBeenNthCalledWith(
			2,
			2,
			{
				path: "./images/second.png",
				src: "./images/second.png",
				fileName: "second.png",
			},
			{ ensurePromptMention: true, retainReferenceSlot: false },
		)
	})

	it("uses the first empty manual slot and ignores linked media when appending", () => {
		const replaceReferenceFileAt = vi.fn()

		applyImportedAssetsToImageSlots({
			slot: { slotIndex: 2 },
			// Two manual references plus one linked reference are visible in the UI.
			currentReferenceFileCount: 2,
			imported: [createImported("first"), createImported("second")],
			handlers: { replaceReferenceFileAt },
		})

		expect(replaceReferenceFileAt.mock.calls.map(([slotIndex]) => slotIndex)).toEqual([2, 3])
	})

	it("appends after manual references when the selected slot belongs to linked media", () => {
		const replaceReferenceFileAt = vi.fn()

		applyImportedAssetsToImageSlots({
			slot: { slotIndex: 3, path: "./linked/reference.png" },
			currentReferenceFileCount: 2,
			imported: [createImported("first"), createImported("second")],
			handlers: { replaceReferenceFileAt },
		})

		expect(replaceReferenceFileAt.mock.calls.map(([slotIndex]) => slotIndex)).toEqual([2, 3])
	})

	it("does not mutate the editor when no assets were confirmed", () => {
		const replaceReferenceFileAt = vi.fn()

		applyImportedAssetsToImageSlots({
			slot: { slotIndex: 0, path: "./images/old.png" },
			currentReferenceFileCount: 1,
			imported: [],
			handlers: { replaceReferenceFileAt },
		})

		expect(replaceReferenceFileAt).not.toHaveBeenCalled()
	})
})
