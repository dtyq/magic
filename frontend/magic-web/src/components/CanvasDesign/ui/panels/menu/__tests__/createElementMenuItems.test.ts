import { describe, expect, it, vi } from "vitest"
import { getCreateElementMenuItems } from "../createElementMenuItems"
import type { MenuOption } from "../types"

function getMenuOption(
	items: ReturnType<typeof getCreateElementMenuItems>,
	id: string,
): MenuOption {
	const item = items.find(
		(candidate): candidate is MenuOption => "id" in candidate && candidate.id === id,
	)
	if (!item) throw new Error(`Menu item ${id} not found`)
	return item
}

describe("getCreateElementMenuItems", () => {
	it("creates the three requested entries and forwards the selected kind", () => {
		const onSelect = vi.fn()
		const items = getCreateElementMenuItems({
			idPrefix: "canvas-create",
			translate: (_key, fallback) => fallback,
			onSelect,
			translationKeys: {
				text: "menu.createText",
				imageGenerator: "menu.createImageGenerator",
				videoGenerator: "menu.createVideoGenerator",
			},
		})

		expect(items.map((item) => ("id" in item ? item.id : item.type))).toEqual([
			"canvas-create-text",
			"canvas-create-image-generator",
			"canvas-create-video-generator",
		])
		expect(items.map((item) => ("label" in item ? item.label : item.type))).toEqual([
			"文本",
			"图片生成",
			"视频生成",
		])

		getMenuOption(items, "canvas-create-text").onClick?.()
		getMenuOption(items, "canvas-create-image-generator").onClick?.()
		getMenuOption(items, "canvas-create-video-generator").onClick?.()

		expect(onSelect).toHaveBeenCalledWith("text")
		expect(onSelect).toHaveBeenCalledWith("image-generator")
		expect(onSelect).toHaveBeenCalledWith("video-generator")
	})
})
