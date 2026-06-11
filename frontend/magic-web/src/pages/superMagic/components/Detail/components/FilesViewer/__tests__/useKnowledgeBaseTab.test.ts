import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useKnowledgeBaseTab } from "../hooks/useKnowledgeBaseTab"

describe("useKnowledgeBaseTab", () => {
	it("uses the fileKey suffix as file_extension when opening a knowledge base tab", () => {
		const { result } = renderHook(() => useKnowledgeBaseTab())

		act(() => {
			result.current.openKnowledgeBaseTab({
				knowledgeBaseId: "KNOWLEDGE-1",
				documentCode: "DOC-1",
				fileKey: "DT001/reports/source.final.PDF?download=1#page=2",
				title: "source.final.PDF",
			})
		})

		expect(result.current.knowledgeBaseTabs[0].fileData.file_extension).toBe("pdf")
	})
})
