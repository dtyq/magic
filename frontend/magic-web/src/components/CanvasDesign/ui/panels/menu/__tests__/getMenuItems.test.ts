import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../../runtime/core/Canvas"
import type { MenuOption } from "../types"
import { getMenuItems } from "../getMenuItems"

function createCanvas(selectedIds: string[]) {
	const elements = new Map([
		["image-1", { id: "image-1", type: "image", src: "images/one.png" }],
		["image-2", { id: "image-2", type: "image", src: "images/two.png" }],
	])
	const canExecute = vi.fn().mockReturnValue(true)

	return {
		canvas: {
			can: vi.fn((capability: string) => capability !== "document.write"),
			permissionManager: {
				can: vi.fn((capability: string) => capability !== "document.write"),
			},
			selectionManager: { getSelectedIds: () => selectedIds },
			elementManager: { getElementData: (id: string) => elements.get(id) },
			userActionRegistry: {
				canExecute,
				execute: vi.fn(),
			},
		} as unknown as Canvas,
		canExecute,
	}
}

function getMenuOption(items: ReturnType<typeof getMenuItems>, id: string): MenuOption {
	const item = items.find(
		(candidate): candidate is MenuOption => "id" in candidate && candidate.id === id,
	)
	if (!item) throw new Error(`Menu item ${id} not found`)
	return item
}

describe("getMenuItems", () => {
	it("keeps the default download label and hides project-file location for multi-selection", () => {
		const { canvas, canExecute } = createCanvas(["image-1", "image-2"])
		const items = getMenuItems({
			canvas,
			selectedIds: ["image-1", "image-2"],
			currentElementId: "image-1",
			downloadMenuContext: {
				useAiImageSubmenu: false,
				selectionKind: "image-only",
			},
			permissions: { elementMenuConversationActions: false },
		})

		expect(getMenuOption(items, "download-image").label).toBe("下载文件")
		expect(getMenuOption(items, "locate-project-file").visible?.()).toBe(false)
		expect(canExecute).not.toHaveBeenCalledWith("view.locate-project-file", expect.anything())
	})

	it("keeps project-file location available for a single selected media element", () => {
		const { canvas } = createCanvas(["image-1"])
		const items = getMenuItems({
			canvas,
			selectedIds: ["image-1"],
			currentElementId: "image-1",
			permissions: { elementMenuConversationActions: false },
		})

		expect(getMenuOption(items, "locate-project-file").visible?.()).toBe(true)
	})

	it("opens the save-to-assets dialog only for an eligible single image", () => {
		const { canvas } = createCanvas(["image-1"])
		const onSaveAsset = vi.fn()
		const items = getMenuItems({
			canvas,
			selectedIds: ["image-1"],
			currentElementId: "image-1",
			permissions: { elementMenuConversationActions: false },
			saveAssetMenuConfig: {
				canSaveAsset: (elementId) => elementId === "image-1",
				onSaveAsset,
			},
		})

		const saveItem = getMenuOption(items, "save-to-assets")
		expect(saveItem.visible?.()).toBe(true)
		saveItem.onClick?.()
		expect(onSaveAsset).toHaveBeenCalledWith("image-1")
	})

	it("hides save-to-assets for multi-selection", () => {
		const { canvas } = createCanvas(["image-1", "image-2"])
		const items = getMenuItems({
			canvas,
			selectedIds: ["image-1", "image-2"],
			currentElementId: "image-1",
			saveAssetMenuConfig: {
				canSaveAsset: () => true,
			},
		})

		expect(getMenuOption(items, "save-to-assets").visible?.()).toBe(false)
	})
})
