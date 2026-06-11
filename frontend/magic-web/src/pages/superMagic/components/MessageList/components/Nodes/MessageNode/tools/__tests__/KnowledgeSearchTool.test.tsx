import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import KnowledgeSearchTool from "../KnowledgeSearchTool"

const translations = vi.hoisted(() => new Map<string, string>())

function interpolate(template: string, options?: Record<string, unknown>) {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(options?.[key] ?? ""))
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (
			key: string,
			defaultValueOrOptions?: string | Record<string, unknown>,
			options?: Record<string, unknown>,
		) => {
			const resolvedOptions =
				typeof defaultValueOrOptions === "object" ? defaultValueOrOptions : options
			const defaultValue =
				typeof defaultValueOrOptions === "string"
					? defaultValueOrOptions
					: (resolvedOptions?.defaultValue as string | undefined)
			const template = translations.get(key) ?? defaultValue ?? key
			return interpolate(template, resolvedOptions)
		},
	}),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Message_Suppress_Auto_Scroll: "message_suppress_auto_scroll",
		Open_Knowledge_Base_Tab: "open_knowledge_base_tab",
		Open_Playback_Tab: "open_playback_tab",
	},
}))

const knowledgeSearchToolData = {
	id: "tool-1",
	name: "search_knowledge",
	action: "知识检索",
	remark: "已检索到 1 个文档、1 个片段",
	status: "success",
	detail: {
		type: "knowledge_search",
		data: {
			type: "knowledge_search",
			schema_version: 1,
			status: "success",
			query: "ES 搜索方案",
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
					knowledge_code: "KNOWLEDGE-1",
					knowledge_base_id: "KNOWLEDGE-1",
					knowledge_base_name: "技术知识库",
					document_code: "doc-1",
					document_name: "ES搜索技术方案.md",
					file_key: "DT001/source.md",
					snippets: [
						{
							rank: 1,
							score: 0.82,
							word_count: 183,
							text: "召回片段正文",
							file_key: "DT001/source.md",
							truncated: false,
						},
					],
				},
			],
			truncated: false,
			limits: {
				max_documents: 20,
				max_snippets: 50,
				max_snippet_chars: 2000,
				max_total_chars: 60000,
			},
			error: null,
		},
	},
}

function renderKnowledgeSearchTool(props?: Partial<ComponentProps<typeof KnowledgeSearchTool>>) {
	return render(
		<KnowledgeSearchTool
			toolData={knowledgeSearchToolData}
			loading={false}
			{...props}
		/>,
	)
}

describe("KnowledgeSearchTool", () => {
	beforeEach(() => {
		translations.clear()
		vi.clearAllMocks()
	})

	it("renders knowledge search details and opens a source document from a snippet", () => {
		renderKnowledgeSearchTool()

		expect(screen.getByText("检索知识库")).toBeInTheDocument()
		expect(screen.getByText("ES 搜索方案 · 1 命中")).toBeInTheDocument()
		expect(screen.getByText("ES 搜索方案")).toBeInTheDocument()
		const hit = screen.getByRole("button", { name: "打开来源 ES搜索技术方案.md" })
		expect(within(hit).getByText("召回片段正文")).toBeInTheDocument()
		expect(within(hit).getByText("0.82")).toBeInTheDocument()
		expect(within(hit).getByText("183 字")).toBeInTheDocument()

		fireEvent.click(hit)

		expect(pubsub.publish).toHaveBeenCalledWith(PubSubEvents.Open_Knowledge_Base_Tab, {
			knowledgeBaseId: "KNOWLEDGE-1",
			documentCode: "doc-1",
			fileKey: "DT001/source.md",
			title: "ES搜索技术方案.md",
			knowledgeBaseName: "技术知识库",
			fileExtension: "md",
		})
		expect(pubsub.publish).not.toHaveBeenCalledWith(
			PubSubEvents.Open_Playback_Tab,
			expect.anything(),
		)
	})

	it("opens playback details when the card itself is clicked", () => {
		const onClick = vi.fn()
		renderKnowledgeSearchTool({ onClick })

		fireEvent.click(screen.getByText("检索知识库"))

		expect(onClick).toHaveBeenCalledTimes(1)
		expect(pubsub.publish).not.toHaveBeenCalledWith(
			PubSubEvents.Open_Knowledge_Base_Tab,
			expect.anything(),
		)
	})

	it("uses translated labels for card chrome and snippet metadata", () => {
		translations.set("knowledgeSearch.action", "Search knowledge")
		translations.set("knowledgeSearch.hits", "hits")
		translations.set("knowledgeSearch.openSourceAria", "Open source {{title}}")
		translations.set("knowledgeSearch.wordCount", "{{count}} words")

		renderKnowledgeSearchTool()

		expect(screen.getByText("Search knowledge")).toBeInTheDocument()
		expect(screen.getByText("ES 搜索方案 · 1 hits")).toBeInTheDocument()
		const hit = screen.getByRole("button", { name: "Open source ES搜索技术方案.md" })
		expect(within(hit).getByText("183 words")).toBeInTheDocument()
	})
})
