import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { InterviewFile } from "../types"

const { store, user, transport, nodes } = vi.hoisted(() => ({
	store: {
		selectedProject: { id: "project" },
		selectedTopic: { id: "topic", chat_topic_id: "chat" },
		isReadOnly: false,
		isConversationGenerating: false,
		personas: [{ path: "personas/p1.json", data: { id: "p1" } }],
		interviews: [{ path: "studies/s1/interviews/p1.json", data: { persona_id: "p1" } }],
	},
	user: { user_id: "u1", organization_code: "org" },
	transport: { status: undefined as string | undefined },
	nodes: new Map<string, { content: string }>(),
}))
vi.mock("../context", () => ({ usePersonaResearchStore: () => store }))
vi.mock("@/models/user", () => ({ userStore: { user: { userInfo: user } } }))
vi.mock("@/utils/storage", () => ({ platformKey: (key: string) => key }))
vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		messages: new Map(),
		getMessageNode: (id: string) => nodes.get(id),
	},
}))
vi.mock("@/pages/superMagic/stores/optimisticMessageStore", () => ({
	optimisticMessageStore: {
		getStatus: () => transport.status,
	},
}))

import { useInterviewChat } from "../hooks/useInterviewChat"

const transcript: InterviewFile = {
	schema_version: 1,
	persona_id: "p1",
	status: "done",
	rounds: [],
}

beforeEach(() => {
	sessionStorage.clear()
	store.isReadOnly = false
	user.user_id = "u1"
	transport.status = undefined
})

describe("interview chat lifecycle", () => {
	it("prevents double submits and preserves text typed while a send is pending", async () => {
		let finish!: (accepted: boolean) => void
		const send = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					finish = resolve
				}),
		)
		const { result } = renderHook(() => useInterviewChat(transcript, send))
		act(() => result.current.setDraft("first question"))
		let submitted!: Promise<void>
		act(() => {
			submitted = result.current.send()
			void result.current.send()
		})
		expect(send).toHaveBeenCalledTimes(1)
		act(() => result.current.setDraft("next question"))
		await act(async () => {
			finish(true)
			await submitted
		})
		expect(result.current.draft).toBe("next question")
		expect(result.current.pending?.personaId).toBe("p1")
	})

	it("restores failed sends on remount and retries with the same target and request ID", async () => {
		const send = vi.fn().mockResolvedValue(false)
		const first = renderHook(() => useInterviewChat(transcript, send))
		act(() => first.result.current.setDraft("a question"))
		await act(async () => {
			await first.result.current.send()
		})
		const original = send.mock.calls[0][0]
		expect(first.result.current.failed).toBe(true)
		first.unmount()
		const restored = renderHook(() => useInterviewChat(transcript, send))
		expect(restored.result.current.failed).toBe(true)
		expect(restored.result.current.draft).toBe("a question")
		send.mockResolvedValue(true)
		await act(async () => {
			await restored.result.current.send()
		})
		expect(send.mock.calls[1][0]).toEqual(original)
	})

	it("replaces the pending bubble only after its own persisted persona answer arrives", async () => {
		const send = vi.fn().mockResolvedValue(true)
		const { result, rerender } = renderHook(({ file }) => useInterviewChat(file, send), {
			initialProps: { file: transcript },
		})
		act(() => result.current.setDraft("question"))
		await act(async () => {
			await result.current.send()
		})
		const requestId = result.current.pending?.id
		expect(requestId).toBeDefined()
		rerender({
			file: {
				...transcript,
				rounds: [{ role: "persona", text: "another answer", request_id: "other" }],
			},
		})
		expect(result.current.pending).toBeDefined()
		rerender({
			file: {
				...transcript,
				rounds: [{ role: "persona", text: "the answer", request_id: requestId }],
			},
		})
		expect(result.current.pending).toBeUndefined()
	})

	it("isolates drafts by account and blocks writes in a read-only view", async () => {
		const send = vi.fn().mockResolvedValue(true)
		const first = renderHook(() => useInterviewChat(transcript, send))
		act(() => first.result.current.setDraft("private draft"))
		first.unmount()
		user.user_id = "u2"
		store.isReadOnly = true
		const second = renderHook(() => useInterviewChat(transcript, send))
		expect(second.result.current.draft).toBe("")
		act(() => second.result.current.setDraft("question"))
		await act(async () => {
			await second.result.current.send()
		})
		expect(send).not.toHaveBeenCalled()
	})
})
