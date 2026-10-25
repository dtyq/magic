import { beforeEach, describe, expect, it } from "vitest"
import { MentionItemType } from "../../../../../types"
import type { MentionHistoryItem } from "../types"
import { MentionPanelHistoryStore } from "../store"

describe("MentionPanelHistoryStore", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("migrates legacy micro app history keys to the app id key", () => {
		const store = new MentionPanelHistoryStore({
			projectFilesStore: {
				currentSelectedProject: undefined,
				workspaceFilesList: [],
			} as never,
			getCurrentTabs: () => [],
		})
		const cache = (
			store as unknown as {
				getHistoryCache: (namespace: string) => {
					put: (key: string, value: MentionHistoryItem) => void
					getAll: () => Array<{ key: string; value: MentionHistoryItem }>
				}
			}
		).getHistoryCache("global")
		const legacyKey = 'micro_app_unknown:{"app_id":"app-1","app_name":"库存助手"}'

		cache.put(legacyKey, {
			id: legacyKey,
			name: "库存助手",
			type: MentionItemType.MICRO_APP,
			data: { app_id: "app-1", app_name: "库存助手" },
			usage: 2,
		})

		expect(store.getHistory()).toEqual([
			expect.objectContaining({
				id: "micro_app_app-1",
				type: MentionItemType.MICRO_APP,
				usage: 2,
			}),
		])
		expect(cache.getAll().map((item) => item.key)).toEqual(["micro_app_app-1"])
	})
})
