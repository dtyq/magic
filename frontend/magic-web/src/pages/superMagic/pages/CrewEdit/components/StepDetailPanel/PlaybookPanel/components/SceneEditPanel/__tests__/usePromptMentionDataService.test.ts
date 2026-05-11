import { describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { createPromptMentionDataService } from "../components/DemoItemEditDialog/promptMentionDataService"

describe("createPromptMentionDataService", () => {
	it("filters mention results to skill/mcp/tool/agent items", async () => {
		const baseStore = {
			dispatch: vi.fn().mockResolvedValue({
				items: [
					{
						id: "project-files",
						type: MentionItemType.FOLDER,
						name: "Project Files",
					},
					{
						id: "agents",
						type: MentionItemType.AGENT,
						name: "Agents",
					},
					{
						id: "skills",
						type: MentionItemType.SKILL,
						name: "Skills",
					},
					{
						id: "upload-files",
						type: MentionItemType.FOLDER,
						name: "Uploads",
					},
				],
			}),
		} as never

		const dataService = createPromptMentionDataService(baseStore)
		const result = await dataService.dispatch({ kind: "default", options: { t: {} as never } })

		expect(baseStore.dispatch).toHaveBeenCalledTimes(1)
		expect(result).toEqual({
			items: [
				{
					id: "agents",
					type: MentionItemType.AGENT,
					name: "Agents",
				},
				{
					id: "skills",
					type: MentionItemType.SKILL,
					name: "Skills",
				},
			],
		})
	})
})
