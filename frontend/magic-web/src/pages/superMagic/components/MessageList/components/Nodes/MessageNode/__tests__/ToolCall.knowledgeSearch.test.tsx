import { fireEvent, render, screen } from "@testing-library/react"
import { Suspense } from "react"
import { describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ToolCall } from "../ToolCall"

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		toolResponseMap: new Map(),
	},
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Open_Playback_Tab: "open_playback_tab",
	},
}))

vi.mock("../tools/KnowledgeSearchTool", () => ({
	default: ({ loading, onClick }: { loading?: boolean; onClick?: () => void }) => (
		<div>
			<span>{loading ? "loading" : "loaded"}</span>
			<button type="button" onClick={onClick}>
				open knowledge playback
			</button>
		</div>
	),
}))

vi.mock("../tools/askUser", () => ({
	default: ({ loading }: { loading?: boolean }) => (
		<span>{loading ? "ask user loading" : "ask user loaded"}</span>
	),
}))

vi.mock("../tools/DefaultTool", () => ({
	default: ({ loading }: { loading?: boolean }) => (
		<span>{loading ? "default loading" : "default loaded"}</span>
	),
}))

vi.mock("../tools/WriteFile", () => ({
	default: () => null,
}))

vi.mock("../tools/MCPTool", () => ({
	MCPTool: () => null,
}))

describe("ToolCall knowledge search playback", () => {
	it("uses historical tool detail when opening playback from a knowledge search card", () => {
		render(
			<ToolCall
				topicId="topic-1"
				correlationId="corr-1"
				toolCall={{
					id: "tool-1",
					type: "function",
					function: {
						name: "search_knowledge",
						label: "知识检索",
						arguments: "{}",
					},
					tool: {
						id: "tool-1",
						name: "search_knowledge",
						action: "知识检索",
						status: "success",
						detail: {
							type: "knowledge_search",
							data: {
								type: "knowledge_search",
								query: "es",
								documents: [],
							},
						},
					},
				}}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "open knowledge playback" }))

		expect(pubsub.publish).toHaveBeenCalledWith(
			PubSubEvents.Open_Playback_Tab,
			expect.objectContaining({
				id: "tool-1",
				name: "search_knowledge",
				type: "knowledge_search",
				data: expect.objectContaining({
					query: "es",
				}),
			}),
		)
	})

	it("does not keep loading when knowledge search status is stored in detail data", () => {
		render(
			<ToolCall
				topicId="topic-1"
				correlationId="corr-1"
				toolCall={{
					id: "tool-1",
					type: "function",
					function: {
						name: "search_knowledge",
						label: "知识检索",
						arguments: "{}",
					},
					tool: {
						id: "tool-1",
						name: "search_knowledge",
						action: "知识检索",
						detail: {
							type: "knowledge_search",
							data: {
								type: "knowledge_search",
								status: "success",
								query: "es",
								documents: [],
							},
						},
					},
				}}
			/>,
		)

		expect(screen.getByText("loaded")).toBeInTheDocument()
	})

	it("does not keep a normal historical tool loading when a tool response object exists", () => {
		render(
			<ToolCall
				topicId="topic-1"
				correlationId="corr-1"
				toolCall={{
					id: "tool-1",
					type: "function",
					function: {
						name: "read_file",
						label: "读取文件",
						arguments: "{}",
					},
					tool: {
						id: "tool-1",
						name: "read_file",
						action: "读取文件",
						remark: "已读取文件",
					},
				}}
			/>,
		)

		expect(screen.getByText("default loaded")).toBeInTheDocument()
	})

	it("does not keep a historical ask_user tool loading when a tool response object exists", async () => {
		render(
			<Suspense fallback={null}>
				<ToolCall
					topicId="topic-1"
					correlationId="corr-1"
					toolCall={{
						id: "tool-1",
						type: "function",
						function: {
							name: "ask_user",
							label: "询问用户",
							arguments: "{}",
						},
						tool: {
							id: "tool-1",
							name: "ask_user",
							action: "询问用户",
							remark: "用户已回复",
						},
					}}
				/>
			</Suspense>,
		)

		expect(await screen.findByText("ask user loaded")).toBeInTheDocument()
	})
})
