import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicStore } from "@/pages/superMagic/stores"
import type { SuperMagicChunkMessage } from "@/types/chat/intermediate_message"
import { IntermediateMessageType } from "@/types/chat/intermediate_message"
import { getToolRemarkPreviewStrategy } from "../registry"

const CORRELATION_ID = "3c93bb53-a127-4de2-96f5-85c78ef2e87a"

function createReadFilesChunk(index: number, argumentsFragment: string): SuperMagicChunkMessage {
	return {
		magic_message_id: `magic-chunk-${index}`,
		app_message_id: `app-chunk-${index}`,
		type: IntermediateMessageType.SuperMagicChunk,
		project_id: "project-1",
		topic_id: "topic-read-files",
		chat_topic_id: "topic-read-files",
		message_id: "completion-read-files",
		super_magic_chunk: {
			super_message_id: "super-read-files",
			task_id: "task-read-files",
			i: index,
			usage: null,
			correlation_id: CORRELATION_ID,
			choices: [
				{
					index: 0,
					finish_reason: null,
					delta: {
						content: "",
						role: "assistant",
						reasoning_content: "",
						index: 0,
						tool_calls: [
							{
								index: 0,
								type: "function",
								function: {
									name: index === 0 ? "read_files" : undefined,
									arguments: argumentsFragment,
								},
							},
						],
					},
				},
			],
		},
	}
}

describe("read_files remark preview / streamed arguments", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	it("exposes complete canonical arguments when the stream closes the file path", () => {
		const chunks = [
			createReadFilesChunk(0, '{"operations":[{"file_path": "'),
			createReadFilesChunk(1, '中国未来发展规划.md"}]}'),
		]
		const topicId = chunks[0].topic_id
		const store = new SuperMagicStore()
		const parser = getToolRemarkPreviewStrategy("read_files")?.createParser()

		store.setActiveTopicId(topicId)
		chunks.forEach((chunk) => {
			store.receiveChunk(chunk, { persist: false })
		})

		const canonicalArguments =
			store.getStreamState(topicId, CORRELATION_ID)?.tool_calls[0]?.function.arguments || ""
		expect(canonicalArguments).toContain('"file_path": "中国未来发展规划.md"')
		expect(parser?.parse(canonicalArguments)).toEqual({
			status: "resolved",
			value: "中国未来发展规划.md",
		})
	})
})
