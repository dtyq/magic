import { describe, expect, it } from "vitest"
import type { LocaleText } from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"
import type { SceneItem } from "../../../types"
import { DEFAULT_INSPIRATION_GROUP_KEY, SceneEditStore } from "../store"

const defaultGroupName: LocaleText = {
	default: "Default Group",
	zh_CN: "默认分组",
	en_US: "Default Group",
}

const customGroupName: LocaleText = {
	default: "Custom Group",
	zh_CN: "自定义分组",
	en_US: "Custom Group",
}

function createScene(): SceneItem {
	return {
		id: "scene-1",
		name: "Scene",
		description: "Description",
		icon: "circle",
		enabled: true,
		update_at: new Date().toISOString(),
		configs: {
			inspiration: {
				type: "demo",
				demo: {
					groups: [],
				},
			},
		},
	}
}

describe("SceneEditStore inspiration defaults", () => {
	it("creates a stable default group when first item is added", () => {
		const store = new SceneEditStore(createScene())

		store.createInspirationItem(
			{
				label: "Item",
				description: "Prompt",
			},
			"",
			defaultGroupName,
		)

		const inspiration = store.inspiration

		expect(inspiration?.demo.default_selected_group_key).toBe(DEFAULT_INSPIRATION_GROUP_KEY)
		expect(inspiration?.demo.groups).toHaveLength(1)
		expect(inspiration?.demo.groups[0]?.group_key).toBe(DEFAULT_INSPIRATION_GROUP_KEY)
		expect(inspiration?.demo.groups[0]?.children).toHaveLength(1)
	})

	it("keeps the default group when first custom group is created", () => {
		const store = new SceneEditStore(createScene())

		const customGroupKey = store.createInspirationGroup(
			{
				group_name: customGroupName,
			},
			defaultGroupName,
		)

		const inspiration = store.inspiration

		expect(inspiration?.demo.default_selected_group_key).toBe(DEFAULT_INSPIRATION_GROUP_KEY)
		expect(inspiration?.demo.groups).toHaveLength(2)
		expect(inspiration?.demo.groups[0]?.group_key).toBe(DEFAULT_INSPIRATION_GROUP_KEY)
		expect(inspiration?.demo.groups[1]?.group_key).toBe(customGroupKey)
		expect(inspiration?.demo.groups[1]?.group_name).toEqual(customGroupName)
	})
})
