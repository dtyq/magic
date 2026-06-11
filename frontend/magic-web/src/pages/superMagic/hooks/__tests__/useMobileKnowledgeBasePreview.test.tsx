import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMobileKnowledgeBasePreview } from "../useMobileKnowledgeBasePreview"

vi.mock("@/utils/pubsub", () => {
	const handlers = new Map<string, Set<(payload: unknown) => void>>()

	return {
		default: {
			subscribe: vi.fn((eventName: string, handler: (payload: unknown) => void) => {
				const nextHandlers = handlers.get(eventName) || new Set()
				nextHandlers.add(handler)
				handlers.set(eventName, nextHandlers)
			}),
			unsubscribe: vi.fn((eventName: string, handler?: (payload: unknown) => void) => {
				if (!handler) {
					handlers.delete(eventName)
					return
				}
				handlers.get(eventName)?.delete(handler)
			}),
			publish: vi.fn((eventName: string, payload: unknown) => {
				handlers.get(eventName)?.forEach((handler) => handler(payload))
			}),
		},
		PubSubEvents: {
			Open_Knowledge_Base_Tab: "open_knowledge_base_tab",
		},
	}
})

describe("useMobileKnowledgeBasePreview", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("opens mobile knowledge preview from the shared knowledge tab event", () => {
		const { result } = renderHook(() => useMobileKnowledgeBasePreview())

		act(() => {
			pubsub.publish(PubSubEvents.Open_Knowledge_Base_Tab, {
				knowledgeBaseId: "KB-1",
				documentCode: "DOC-1",
				fileKey: "folder/source.PDF",
				title: "source.PDF",
				knowledgeBaseName: "技术知识库",
			})
		})

		expect(result.current.visible).toBe(true)
		expect(result.current.previewData).toEqual({
			knowledgeBaseId: "KB-1",
			documentCode: "DOC-1",
			fileKey: "folder/source.PDF",
			title: "source.PDF",
			knowledgeBaseName: "技术知识库",
			fileExtension: "pdf",
		})
	})

	it("ignores invalid knowledge preview events", () => {
		const { result } = renderHook(() => useMobileKnowledgeBasePreview())

		act(() => {
			pubsub.publish(PubSubEvents.Open_Knowledge_Base_Tab, {
				knowledgeBaseId: "KB-1",
				title: "missing target",
			})
		})

		expect(result.current.visible).toBe(false)
		expect(result.current.previewData).toBeNull()
	})
})
