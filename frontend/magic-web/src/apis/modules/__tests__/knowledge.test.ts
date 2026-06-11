import { describe, expect, it, vi } from "vitest"
import type { HttpClient } from "../../core/HttpClient"
import { generateKnowledgeApi } from "../knowledge"

describe("generateKnowledgeApi", () => {
	it("requests knowledge source file link through the Go source-link endpoint", async () => {
		const sourceLink = {
			available: true,
			url: "https://example.com/source.md",
			name: "source.md",
			file_key: "DT001/source.md",
			type: "external",
			source_type: "gov_oa",
			link_type: "download",
		}
		const post = vi.fn().mockResolvedValue({ data: sourceLink })
		const knowledgeApi = generateKnowledgeApi({
			post,
		} as unknown as HttpClient)

		const result = await knowledgeApi.getKnowledgeSourceFileLink({
			knowledgeBaseCode: "KNOWLEDGE-1",
			documentCode: "doc-1",
			fileKey: "DT001/source.md",
		})

		expect(result).toEqual({ data: sourceLink })
		expect(post).toHaveBeenCalledWith(
			"/go/api/v1/knowledge-bases/KNOWLEDGE-1/documents/doc-1/source-file-link",
			{ file_key: "DT001/source.md" },
		)
	})
})
