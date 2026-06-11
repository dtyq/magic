import { Suspense } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ContentRenderer from "../index"

vi.mock("@/pages/superMagic/components/Detail/contents/KnowledgeSearch", () => ({
	default: ({ data }: { data: { query?: string } }) => (
		<div data-testid="knowledge-search-renderer">{data.query}</div>
	),
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

describe("ContentRenderer knowledge search detail", () => {
	it("routes knowledge search recall details to the knowledge search renderer", async () => {
		render(
			<Suspense fallback={null}>
				<ContentRenderer
					type={"knowledge_search" as any}
					data={{
						type: "knowledge_search",
						status: "success",
						query: "es",
						summary: {
							document_count: 1,
							snippet_count: 1,
							shown_document_count: 1,
							shown_snippet_count: 1,
						},
						documents: [
							{
								rank: 1,
								document_name: "ES搜索技术方案.md",
								snippets: [{ rank: 1, score: 0.82, text: "召回片段正文" }],
							},
						],
					}}
					commonProps={{ isPlaybackMode: true, showFileHeader: false }}
				/>
			</Suspense>,
		)

		expect(await screen.findByTestId("knowledge-search-renderer")).toHaveTextContent("es")
	})
})
