import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementRenameManager } from "../ElementRenameManager"

function createManager(options: { locked?: boolean } = {}) {
	const element = {
		id: "image-1",
		type: "image",
		name: "图片",
		contents: [],
	} as never
	const update = vi.fn()
	const canvas = {
		elementManager: {
			getElementData: vi.fn(() => element),
			getElementInstance: vi.fn(() => ({
				getNameLabelContent: () => ({ primaryText: "图片" }),
				getRenderName: () => "图片",
			})),
			update,
		},
		permissionManager: {
			canRename: vi.fn(() => !options.locked),
		},
	} as unknown as Canvas

	return { manager: new ElementRenameManager({ canvas }), update }
}

describe("ElementRenameManager", () => {
	it("uses the shared editable-name path for a layer rename", () => {
		const { manager, update } = createManager()

		expect(manager.commitElementName("image-1", "  新图片  ")).toBe(true)
		expect(update).toHaveBeenCalledWith("image-1", { name: "新图片" })
	})

	it("does not update a locked element", () => {
		const { manager, update } = createManager({ locked: true })

		expect(manager.commitElementName("image-1", "新图片")).toBe(false)
		expect(update).not.toHaveBeenCalled()
	})

	it("does not create an update when the editable name is unchanged", () => {
		const { manager, update } = createManager()

		expect(manager.commitElementName("image-1", "图片")).toBe(false)
		expect(update).not.toHaveBeenCalled()
	})
})
