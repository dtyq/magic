import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import KnowledgeSearch from "../index"

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Open_Knowledge_Base_Tab: "open_knowledge_base_tab",
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (
			_key: string,
			defaultValueOrOptions?: string | Record<string, unknown>,
			options?: Record<string, unknown>,
		) => {
			const resolvedOptions =
				typeof defaultValueOrOptions === "object" ? defaultValueOrOptions : options
			const template =
				typeof defaultValueOrOptions === "string"
					? defaultValueOrOptions
					: (resolvedOptions?.defaultValue as string | undefined) || _key
			return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
				String(resolvedOptions?.[key] ?? ""),
			)
		},
	}),
}))

describe("KnowledgeSearch detail content", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders retrieved documents and snippets", () => {
		render(
			<KnowledgeSearch
				data={{
					status: "success",
					query: "es",
					summary: {
						document_count: 1,
						snippet_count: 1,
						shown_document_count: 1,
						shown_snippet_count: 1,
						message: "已检索到 1 个文档、1 个片段",
					},
					documents: [
						{
							rank: 1,
							knowledge_base_name: "ssss",
							document_code: "doc-1",
							document_name: "ES搜索技术方案 - 后端.md",
							snippets: [
								{
									rank: 1,
									score: 0.79,
									word_count: 1688,
									text: "方案设计的核心内容",
								},
							],
						},
					],
				}}
			/>,
		)

		expect(screen.getByText("知识库检索详情")).toBeInTheDocument()
		expect(screen.getByText("查询：es")).toBeInTheDocument()
		expect(screen.getByText("ES搜索技术方案 - 后端.md")).toBeInTheDocument()
		expect(screen.getByText("方案设计的核心内容")).toBeInTheDocument()
		expect(screen.getByText("Score 0.79")).toBeInTheDocument()
	})

	it("renders empty state", () => {
		render(
			<KnowledgeSearch
				data={{
					status: "empty",
					query: "unknown",
					summary: {
						message: "没有检索到相关知识库内容",
					},
					documents: [],
				}}
			/>,
		)

		expect(screen.getAllByText("没有检索到相关知识库内容").length).toBeGreaterThan(0)
	})

	it("renders error state", () => {
		render(
			<KnowledgeSearch
				data={{
					status: "error",
					query: "es",
					error: {
						code: "permission_denied",
						message: "没有知识库权限",
					},
					documents: [],
				}}
			/>,
		)

		expect(screen.getByText("没有知识库权限")).toBeInTheDocument()
	})

	it("opens a knowledge base tab when clicking a recalled document", () => {
		render(
			<KnowledgeSearch
				data={{
					status: "success",
					query: "es",
					documents: [
						{
							rank: 1,
							knowledge_code: "KNOWLEDGE-1",
							knowledge_base_id: "KNOWLEDGE-1",
							knowledge_base_name: "技术知识库",
							document_code: "doc-1",
							document_name: "ES搜索技术方案 - 后端.md",
							file_key: "DT001/source.md",
							snippets: [
								{
									rank: 1,
									score: 0.79,
									word_count: 1688,
									text: "方案设计的核心内容",
								},
							],
						},
					],
				}}
			/>,
		)

		fireEvent.click(screen.getByText("ES搜索技术方案 - 后端.md"))

		expect(pubsub.publish).toHaveBeenCalledWith(PubSubEvents.Open_Knowledge_Base_Tab, {
			knowledgeBaseId: "KNOWLEDGE-1",
			documentCode: "doc-1",
			fileKey: "DT001/source.md",
			title: "ES搜索技术方案 - 后端.md",
			knowledgeBaseName: "技术知识库",
			fileExtension: "md",
		})
	})

	it("allows long file_key metadata to wrap instead of forcing horizontal overflow", () => {
		const longFileKey =
			"DT001/knowledge-base/documents/very-long-folder-name-without-natural-breakpoints/source-document-with-a-very-long-name.md"

		render(
			<KnowledgeSearch
				data={{
					status: "success",
					query: "es",
					documents: [
						{
							rank: 1,
							knowledge_base_name: "技术知识库",
							document_code: "doc-1",
							document_name: "ES搜索技术方案 - 后端.md",
							file_key: longFileKey,
							snippets: [],
						},
					],
				}}
			/>,
		)

		const fileKeyMeta = screen.getByText(`file_key: ${longFileKey}`)
		expect(fileKeyMeta).toHaveClass("break-all")
		expect(fileKeyMeta).toHaveClass("max-w-full")
	})
})
