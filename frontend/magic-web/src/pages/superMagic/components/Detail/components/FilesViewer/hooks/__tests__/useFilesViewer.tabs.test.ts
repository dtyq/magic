import { describe, expect, it, vi } from "vitest"
import type { TabItem } from "../../types"
import { TabActionType } from "../../types"
import { tabReducer } from "../tabReducer"

function tab(id: string, closeable: boolean, active = false, fileData = {}): TabItem {
	return {
		id,
		title: id,
		fileData: { file_id: id, file_name: `${id}.html`, ...fileData },
		active,
		closeable,
		create_at: Number(id.replace(/\D/g, "")) || 1,
		active_at: Number(id.replace(/\D/g, "")) || 1,
	}
}

describe("FilesViewer protected tabs", () => {
	it("does not remove a protected tab through any close action", () => {
		vi.spyOn(Date, "now").mockReturnValue(100)
		const state = [tab("index", false, true), tab("admin", true)]

		expect(
			tabReducer(state, {
				type: TabActionType.REMOVE_TAB,
				payload: { tabId: "index" },
			}),
		).toEqual(state)
		expect(tabReducer(state, { type: TabActionType.CLEAR_TABS })).toEqual([
			{ ...state[0], active: true },
		])
		expect(
			tabReducer(state, {
				type: TabActionType.CLEAR_TABS,
				payload: { force: true },
			}),
		).toEqual([])
		expect(
			tabReducer(state, {
				type: TabActionType.CLOSE_OTHER_TABS,
				payload: { tabId: "admin" },
			}),
		).toEqual([
			{ ...state[0], active: false },
			{ ...state[1], active: true, active_at: 100 },
		])
		expect(
			tabReducer([tab("admin", true, true), tab("index", false)], {
				type: TabActionType.CLOSE_TABS_TO_RIGHT,
				payload: { tabId: "admin" },
			}),
		).toEqual([tab("admin", true, true), tab("index", false)])
	})

	it("keeps a protected tab locked when the same file is opened again", () => {
		vi.spyOn(Date, "now").mockReturnValue(100)
		const protectedTab = tab("index", false, true)
		const reopenedTab = tab("index", true, true)

		const result = tabReducer([protectedTab], {
			type: TabActionType.ADD_TAB,
			payload: { tab: reopenedTab },
		})

		expect(result[0]).toMatchObject({
			id: "index",
			active: true,
			active_at: 100,
			closeable: false,
		})
	})

	it("updates and clears HTML navigation context when reopening the same file", () => {
		vi.spyOn(Date, "now").mockReturnValue(100)
		const oldNavigation = {
			filePath: "detail.html",
			search: "?mode=old",
			hash: "#old",
			anchor: "old",
		}
		const newNavigation = {
			filePath: "detail.html",
			search: "?mode=new",
			hash: "#new",
			anchor: "new",
		}

		const withNewNavigation = tabReducer(
			[tab("detail", true, true, { htmlNavigation: oldNavigation })],
			{
				type: TabActionType.ADD_TAB,
				payload: { tab: tab("detail", true, true, { htmlNavigation: newNavigation }) },
			},
		)
		expect(withNewNavigation[0].fileData.htmlNavigation).toEqual(newNavigation)

		const withoutNavigation = tabReducer(withNewNavigation, {
			type: TabActionType.ADD_TAB,
			payload: { tab: tab("detail", true, true) },
		})
		expect(withoutNavigation[0].fileData.htmlNavigation).toBeUndefined()
	})
})
