import { describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { insertCurrentMicroAppMention } from "../insertCurrentMicroAppMention"

function createEditor(doc: object) {
	return {
		isDestroyed: false,
		getJSON: vi.fn(() => doc),
		commands: {
			insertContent: vi.fn(),
			focus: vi.fn(),
		},
	}
}

describe("insertCurrentMicroAppMention", () => {
	it("inserts the current app mention and focuses the editor", () => {
		const editor = createEditor({ type: "doc", content: [] })

		insertCurrentMicroAppMention(editor as never, {
			appId: "app-1",
			appName: "Todo App",
		})

		expect(editor.commands.insertContent).toHaveBeenCalledWith({
			type: "mention",
			attrs: {
				type: MentionItemType.MICRO_APP,
				data: { app_id: "app-1", app_name: "Todo App" },
			},
		})
		expect(editor.commands.focus).toHaveBeenCalled()
	})

	it("does not insert a duplicate mention", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: MentionItemType.MICRO_APP,
								data: { app_id: "app-1" },
							},
						},
					],
				},
			],
		})

		insertCurrentMicroAppMention(editor as never, { appId: "app-1", appName: "Todo App" })

		expect(editor.commands.insertContent).not.toHaveBeenCalled()
		expect(editor.commands.focus).toHaveBeenCalled()
	})
})
