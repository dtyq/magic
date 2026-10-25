import { describe, expect, it } from "vitest"
import type { PublishedMicroAppTabItem } from "../../hooks/usePublishedMicroAppTab"
import { resolvePlaybackTabFallback } from "../playbackTabFallback"

function microAppTab(id: string, create_at: number): PublishedMicroAppTabItem {
	return {
		id: `__micro_app__${id}`,
		type: "micro_app",
		title: id,
		isPublishedMicroAppTab: true,
		active: false,
		closeable: true,
		fileData: {},
		data: { appId: id },
		create_at,
	}
}

describe("resolvePlaybackTabFallback", () => {
	it("keeps a published micro-app preview visible when no file tab exists", () => {
		const result = resolvePlaybackTabFallback({
			fileTabs: [],
			knowledgeBaseTabs: [],
			publishedMicroAppTabs: [microAppTab("calendar", 2)],
		})

		expect(result).toEqual({
			type: "micro_app",
			tab: expect.objectContaining({ id: "__micro_app__calendar" }),
		})
	})
})
