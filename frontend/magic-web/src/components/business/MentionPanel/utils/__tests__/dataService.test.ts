import { describe, expect, it, vi } from "vitest"
import { MentionItemType } from "../../types"
import type { DataService } from "../../types"
import { validateMentionWithDataService } from "../dataService"

function createMockDataService(): DataService {
	return {
		dispatch: vi.fn(),
	}
}

describe("validateMentionWithDataService", () => {
	it("should prefer dispatch validation when available", () => {
		const dataService = createMockDataService()
		vi.mocked(dataService.dispatch).mockReturnValue({
			isValid: true,
		})

		const isValid = validateMentionWithDataService(dataService, {
			type: MentionItemType.AGENT,
			data: {
				agent_id: "agent-1",
				agent_name: "Agent 1",
				agent_avatar: "",
				agent_description: "",
			},
		})

		expect(dataService.dispatch).toHaveBeenCalledWith({
			kind: "validate",
			item: expect.objectContaining({
				type: MentionItemType.AGENT,
			}),
		})
		expect(isValid).toBe(true)
	})

	it("should return false when validation dispatch is async", () => {
		const dataService = createMockDataService()
		vi.mocked(dataService.dispatch).mockResolvedValue({
			isValid: true,
		})

		const isValid = validateMentionWithDataService(dataService, {
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: "file-1",
				file_name: "demo.ts",
				file_path: "src/demo.ts",
				file_extension: "ts",
			},
		})

		expect(isValid).toBe(false)
	})
})
