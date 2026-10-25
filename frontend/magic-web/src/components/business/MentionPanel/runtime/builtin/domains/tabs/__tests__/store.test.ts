import { describe, expect, it } from "vitest"
import { MentionItemType } from "../../../../../types"
import { MentionPanelTabsStore } from "../store"

describe("MentionPanelTabsStore", () => {
	it("preserves published micro-app tabs as micro-app mentions", () => {
		const store = new MentionPanelTabsStore({
			getFolderMentionItemsFromTab: () => null,
		})

		const tab: Parameters<MentionPanelTabsStore["tabToMentionItem"]>[0] = {
			id: "__micro_app__app-1",
			type: "micro_app",
			title: "内容运营日历与AI选题排期设计",
			fileData: { file_id: "", file_name: "" },
			data: { appId: "app-1", appName: "内容运营日历与AI选题排期设计" },
			active: true,
			closeable: true,
		}

		store.setTabs([tab])
		const [item] = store.getCurrentTabs()

		expect(item).toMatchObject({
			id: "micro-app:app-1",
			type: MentionItemType.MICRO_APP,
			data: { app_id: "app-1", app_name: "内容运营日历与AI选题排期设计" },
		})
		expect(item.icon).toBeUndefined()
	})

	it("keeps display config on file mentions for shared special icons", () => {
		const store = new MentionPanelTabsStore({
			getFolderMentionItemsFromTab: () => null,
		})

		store.setTabs([
			{
				id: "template-folder",
				title: "PPT-soft-pink-midyear-review",
				fileData: {
					file_id: "template-folder",
					file_name: "PPT-soft-pink-midyear-review",
					display_config: { type: "slide-template" },
				},
				active: true,
				closeable: true,
			},
		])

		const [item] = store.getCurrentTabs()

		expect(item).toMatchObject({
			displayConfig: { type: "slide-template" },
			icon: "slide-template",
		})
	})
})
