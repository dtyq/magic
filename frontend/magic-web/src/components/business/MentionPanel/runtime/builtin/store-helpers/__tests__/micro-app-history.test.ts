import { describe, expect, it } from "vitest"
import { zhCN } from "../../../../i18n/locales/zh-CN"
import { getBuiltinMentionItemRenderer } from "../../renderer"
import { MentionItemType } from "../../../../types"
import { getItemTypeDescription } from "../../../../utils/getValue"
import { convertMentionListItemToMentionItem } from "../history"

describe("micro app mention history", () => {
	it("keeps the micro app identity and type when converting editor mentions", () => {
		const item = convertMentionListItemToMentionItem({
			type: "mention",
			attrs: {
				type: MentionItemType.MICRO_APP,
				data: { app_id: "app-1", app_name: "库存助手" },
			},
		})

		expect(item).toMatchObject({
			id: "micro-app:app-1",
			name: "库存助手",
			type: MentionItemType.MICRO_APP,
			icon: "",
			data: { app_id: "app-1", app_name: "库存助手" },
		})
		if (!item) throw new Error("Expected a micro app mention item")
		expect(getItemTypeDescription(item, zhCN)).toBe("微应用")
	})

	it("falls back to the micro app icon for legacy attachment history icons", () => {
		const renderer = getBuiltinMentionItemRenderer(MentionItemType.MICRO_APP)
		const icon = renderer.renderIcon?.({
			item: {
				id: "micro-app:app-1",
				name: "库存助手",
				type: MentionItemType.MICRO_APP,
				icon: "ts-attachment",
				data: { app_id: "app-1", app_name: "库存助手" },
			},
			t: zhCN,
			platform: "desktop",
		})

		expect(icon).not.toBeNull()
		expect((icon as { type?: unknown }).type).not.toBe("img")
	})
})
