import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isObservable, observable } from "mobx"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type {
	MessageStreamStartedEvent,
	TaskCompletedEvent,
	ToolCallSettledEvent,
} from "@/pages/superMagic/stores"
import { useMagicWidgetBridge } from "../useMagicWidgetBridge"

const { subscribeMock } = vi.hoisted(() => ({ subscribeMock: vi.fn() }))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: { subscribe: subscribeMock },
}))

const HOST_ORIGIN = "https://host.example.invalid"
const INSTANCE_ID = "widget-mock-instance"

/** Builds one protocol command with fictional identifiers and payload data. */
function createCommand(requestId: string, command: string, content?: unknown) {
	return {
		protocol: "magic-widget",
		version: 1,
		instanceId: INSTANCE_ID,
		requestId,
		type: "command",
		command,
		...(content === undefined ? {} : { payload: { content } }),
	}
}

/** Builds one host-owned header action response request with fictional identifiers. */
function createHeaderActionResponse(requestId: string, handled = true) {
	return {
		protocol: "magic-widget",
		version: 1,
		instanceId: INSTANCE_ID,
		requestId,
		type: "response",
		ok: true,
		result: { headerActionHandled: handled },
	}
}

/** Creates fictional structured input covering every SDK-supported mention kind. */
function createStructuredContent() {
	return {
		blocks: [
			{ type: "text", text: "Ask " },
			{
				type: "mention",
				mention: {
					type: "agent",
					data: { agent_id: "agent-mock-001", agent_name: "Agent Mock" },
				},
			},
			{
				type: "mention",
				mention: { type: "skill", data: { id: "skill-mock-001", name: "Skill Mock" } },
			},
			{
				type: "mention",
				mention: { type: "tool", data: { id: "tool-mock-001", name: "Tool Mock" } },
			},
			{
				type: "mention",
				mention: {
					type: "mcp",
					data: { id: "mcp-mock-001", name: "MCP Mock", icon: "mock-icon" },
				},
			},
		],
	}
}

describe("useMagicWidgetBridge", () => {
	let parentWindow: Window
	let postMessage: ReturnType<typeof vi.fn>

	beforeEach(() => {
		subscribeMock.mockReset()
		subscribeMock.mockImplementation(() => vi.fn())
		postMessage = vi.fn()
		parentWindow = { postMessage } as unknown as Window
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
	})

	afterEach(() => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: window,
		})
	})

	it("emits agent_ready and accepts setInput after the caller observes readiness", async () => {
		const createNewConversation = vi.fn()
		const setInputListener = vi.fn((payload) => payload.respond())
		pubsub.subscribe(PubSubEvents.Magic_Widget_Editor_Command, setInputListener)
		const { result, unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation,
			}),
		)
		act(() => result.current.notifyAgentReady())
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "ready", instanceId: INSTANCE_ID }),
			HOST_ORIGIN,
		)

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-mock-set", "setInput", "mock input"),
			}),
		)

		await waitFor(() => expect(setInputListener).toHaveBeenCalledTimes(1))
		expect(setInputListener).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "setInput",
				content: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "mock input" }],
						},
					],
				},
			}),
		)
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "request-mock-set",
				type: "response",
				ok: true,
			}),
			HOST_ORIGIN,
		)

		pubsub.unsubscribe(PubSubEvents.Magic_Widget_Editor_Command, setInputListener)
		unmount()
	})

	it("requests host-owned header actions and resolves whether the host handled them", async () => {
		const { result, unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)

		const actionPromise = result.current.requestHeaderAction("pin", {
			topicId: "topic-mock-header",
		})
		const request = postMessage.mock.calls[0]?.[0] as { requestId: string }
		expect(request).toEqual(
			expect.objectContaining({
				type: "header_action",
				action: "pin",
				context: { action: "pin", topicId: "topic-mock-header" },
			}),
		)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: createHeaderActionResponse(request.requestId),
				}),
			)
		})

		await expect(actionPromise).resolves.toBe(true)
		unmount()
	})

	it("rejects a header action when the host reports failure", async () => {
		const { result, unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)

		const actionPromise = result.current.requestHeaderAction("history")
		const request = postMessage.mock.calls[0]?.[0] as { requestId: string }
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: request.requestId,
						type: "response",
						ok: false,
						error: {
							code: "HEADER_ACTION_FAILED",
							message: "Mock header action failed",
						},
					},
				}),
			)
		})

		await expect(actionPromise).rejects.toThrow("Mock header action failed")
		unmount()
	})

	it("rejects a header action that receives no host response", async () => {
		vi.useFakeTimers()
		try {
			const { result, unmount } = renderHook(() =>
				useMagicWidgetBridge({
					context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
					createNewConversation: vi.fn(),
				}),
			)
			const actionPromise = result.current.requestHeaderAction("share")
			const assertion = expect(actionPromise).rejects.toThrow(
				"Magic widget header action timed out",
			)

			await act(async () => {
				await vi.advanceTimersByTimeAsync(10_000)
			})
			await assertion
			unmount()
		} finally {
			vi.useRealTimers()
		}
	})

	it("does not gate setInput on agent_ready", async () => {
		const setInputListener = vi.fn((payload) => payload.respond())
		pubsub.subscribe(PubSubEvents.Magic_Widget_Editor_Command, setInputListener)
		const { unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-before-ready", "setInput", "early input"),
			}),
		)

		await waitFor(() => expect(setInputListener).toHaveBeenCalledTimes(1))
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "request-before-ready",
				type: "response",
				ok: true,
			}),
			HOST_ORIGIN,
		)

		pubsub.unsubscribe(PubSubEvents.Magic_Widget_Editor_Command, setInputListener)
		unmount()
	})

	it("converts structured blocks into TipTap mention nodes for set and send", async () => {
		const editorCommandListener = vi.fn((payload) => payload.respond())
		const sendListener = vi.fn()
		pubsub.subscribe(PubSubEvents.Magic_Widget_Editor_Command, editorCommandListener)
		pubsub.subscribe(PubSubEvents.Send_Message_by_Content, sendListener)
		const { unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)
		const structuredContent = createStructuredContent()

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-structured-set", "setInput", structuredContent),
			}),
		)

		await waitFor(() => expect(editorCommandListener).toHaveBeenCalledTimes(1))
		expect(editorCommandListener).toHaveBeenCalledWith({
			command: "setInput",
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "Ask " },
							{
								type: "mention",
								attrs: {
									type: "agent",
									data: { agent_id: "agent-mock-001", agent_name: "Agent Mock" },
								},
							},
							expect.objectContaining({
								type: "mention",
								attrs: { type: "skill", data: expect.any(Object) },
							}),
							expect.objectContaining({
								type: "mention",
								attrs: { type: "tool", data: expect.any(Object) },
							}),
							expect.objectContaining({
								type: "mention",
								attrs: { type: "mcp", data: expect.any(Object) },
							}),
						],
					},
				],
			},
			respond: expect.any(Function),
		})

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-structured-send", "sendMessage", structuredContent),
			}),
		)

		await waitFor(() => expect(sendListener).toHaveBeenCalledTimes(1))
		expect(sendListener.mock.calls[0]?.[0].jsonContent.content[0].content).toHaveLength(5)

		pubsub.unsubscribe(PubSubEvents.Magic_Widget_Editor_Command, editorCommandListener)
		pubsub.unsubscribe(PubSubEvents.Send_Message_by_Content, sendListener)
		unmount()
	})

	it("uses the normal editor command when sendMessage omits content", async () => {
		const editorCommandListener = vi.fn((payload) => payload.respond())
		pubsub.subscribe(PubSubEvents.Magic_Widget_Editor_Command, editorCommandListener)
		const { unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-current-send", "sendMessage"),
			}),
		)

		await waitFor(() =>
			expect(editorCommandListener).toHaveBeenCalledWith(
				expect.objectContaining({ command: "sendMessage" }),
			),
		)
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "request-current-send", ok: true }),
			HOST_ORIGIN,
		)

		pubsub.unsubscribe(PubSubEvents.Magic_Widget_Editor_Command, editorCommandListener)
		unmount()
	})

	it("rejects incomplete text mention data without touching the editor", async () => {
		const editorCommandListener = vi.fn((payload) => payload.respond())
		pubsub.subscribe(PubSubEvents.Magic_Widget_Editor_Command, editorCommandListener)
		const { unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-invalid-mention", "setInput", {
					blocks: [
						{
							type: "mention",
							mention: {
								type: "text",
								data: { label: "Chart Mock", text: "chart id: mock-chart" },
							},
						},
					],
				}),
			}),
		)

		await waitFor(() =>
			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					requestId: "request-invalid-mention",
					ok: false,
				}),
				HOST_ORIGIN,
			),
		)
		expect(editorCommandListener).not.toHaveBeenCalled()

		pubsub.unsubscribe(PubSubEvents.Magic_Widget_Editor_Command, editorCommandListener)
		unmount()
	})

	it("resolves newConversation only after the new editor reports agent_ready", async () => {
		const newTopic = { id: "topic-mock-new" } as Topic
		const createNewConversation = vi.fn().mockResolvedValue(newTopic)
		const { result } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation,
			}),
		)

		act(() => result.current.notifyAgentReady())
		postMessage.mockClear()

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-mock-conversation", "newConversation"),
			}),
		)

		await waitFor(() => expect(createNewConversation).toHaveBeenCalledTimes(1))
		expect(
			postMessage.mock.calls.some(
				([message]) => message.requestId === "request-mock-conversation",
			),
		).toBe(false)

		act(() => result.current.notifyAgentReady())

		await waitFor(() =>
			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					requestId: "request-mock-conversation",
					type: "response",
					ok: true,
				}),
				HOST_ORIGIN,
			),
		)
	})

	it("returns an explicit error when message sending is unavailable", async () => {
		const { result } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)
		act(() => result.current.notifyAgentReady())

		window.dispatchEvent(
			new MessageEvent("message", {
				origin: HOST_ORIGIN,
				source: parentWindow,
				data: createCommand("request-mock-send", "sendMessage", "mock message"),
			}),
		)

		await waitFor(() =>
			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					requestId: "request-mock-send",
					type: "response",
					ok: false,
					error: expect.objectContaining({
						message: "Magic widget message sending is not available",
					}),
				}),
				HOST_ORIGIN,
			),
		)
	})

	it("forwards Store runtime events without adding a topic scope and unsubscribes on cleanup", () => {
		const callbacks = new Map<
			string,
			(event: MessageStreamStartedEvent | ToolCallSettledEvent | TaskCompletedEvent) => void
		>()
		const unsubscribeTool = vi.fn()
		const unsubscribeTask = vi.fn()
		const unsubscribeStreamStarted = vi.fn()
		subscribeMock.mockImplementation(
			(
				type: string,
				callback: (
					event: MessageStreamStartedEvent | ToolCallSettledEvent | TaskCompletedEvent,
				) => void,
			) => {
				callbacks.set(type, callback)
				if (type === "toolCall.settled") return unsubscribeTool
				if (type === "task.completed") return unsubscribeTask
				return unsubscribeStreamStarted
			},
		)

		const { unmount } = renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)

		expect(subscribeMock).toHaveBeenNthCalledWith(1, "toolCall.settled", expect.any(Function))
		expect(subscribeMock).toHaveBeenNthCalledWith(2, "task.completed", expect.any(Function))
		expect(subscribeMock).toHaveBeenNthCalledWith(
			3,
			"message.stream.started",
			expect.any(Function),
		)

		const toolEvent: ToolCallSettledEvent = {
			type: "toolCall.settled",
			meta: {
				sequence: 7,
				revision: 2,
				occurredAt: 1_700_000_000_000,
				source: "im",
				topicId: "topic-mock-background",
				superMagicTopicId: "super-magic-topic-mock-background",
				toolCallId: "tool-mock-result",
			},
			payload: {
				toolCall: { id: "tool-mock-result", name: "mock_tool" },
				response: { status: "finished", detail: { refreshed: true } },
				strength: "strong",
				replaceable: false,
			},
		}
		const taskEvent: TaskCompletedEvent = {
			type: "task.completed",
			meta: {
				sequence: 8,
				revision: 1,
				occurredAt: 1_700_000_000_100,
				source: "im",
				topicId: "topic-mock-background",
				correlationId: "correlation-mock-result",
				appMessageId: "message-mock-result",
				taskId: "task-mock-result",
			},
			payload: {
				source: "finish_task",
				result: { detail: { completed: true }, attachments: [] },
			},
		}
		const streamStartedEvent: MessageStreamStartedEvent = {
			type: "message.stream.started",
			meta: {
				sequence: 9,
				revision: 1,
				occurredAt: 1_700_000_000_200,
				source: "stream",
				topicId: "topic-mock-background",
				correlationId: "correlation-mock-stream",
				streamGeneration: 1,
			},
			payload: {
				chunkIndex: 0,
				startsWith: "metadata",
			},
		}

		act(() => callbacks.get("toolCall.settled")?.(toolEvent))
		act(() => callbacks.get("task.completed")?.(taskEvent))
		act(() => callbacks.get("message.stream.started")?.(streamStartedEvent))

		expect(postMessage).toHaveBeenNthCalledWith(
			1,
			{
				protocol: "magic-widget",
				version: 1,
				instanceId: INSTANCE_ID,
				type: "event",
				event: toolEvent,
			},
			HOST_ORIGIN,
		)
		expect(postMessage).toHaveBeenNthCalledWith(
			2,
			{
				protocol: "magic-widget",
				version: 1,
				instanceId: INSTANCE_ID,
				type: "event",
				event: taskEvent,
			},
			HOST_ORIGIN,
		)
		expect(postMessage).toHaveBeenNthCalledWith(
			3,
			{
				protocol: "magic-widget",
				version: 1,
				instanceId: INSTANCE_ID,
				type: "event",
				event: streamStartedEvent,
			},
			HOST_ORIGIN,
		)

		unmount()
		expect(unsubscribeTool).toHaveBeenCalledTimes(1)
		expect(unsubscribeTask).toHaveBeenCalledTimes(1)
		expect(unsubscribeStreamStarted).toHaveBeenCalledTimes(1)
	})

	it("converts observable Store event branches before posting them to the host", () => {
		let forwardToolEvent: ((event: ToolCallSettledEvent) => void) | undefined
		subscribeMock.mockImplementation(
			(type: string, callback: (event: ToolCallSettledEvent) => void) => {
				if (type === "toolCall.settled") forwardToolEvent = callback
				return vi.fn()
			},
		)
		// eslint-disable-next-line no-restricted-syntax
		postMessage.mockImplementation((message: unknown) => structuredClone(message))

		renderHook(() =>
			useMagicWidgetBridge({
				context: { instanceId: INSTANCE_ID, hostOrigin: HOST_ORIGIN },
				createNewConversation: vi.fn(),
			}),
		)

		const observableDetail = observable({ refreshed: true })
		const event: ToolCallSettledEvent = {
			type: "toolCall.settled",
			meta: {
				sequence: 9,
				revision: 1,
				occurredAt: 1_700_000_000_200,
				source: "im",
				topicId: "topic-mock-observable",
				toolCallId: "tool-mock-observable",
			},
			payload: {
				toolCall: { id: "tool-mock-observable", name: "mock_tool" },
				response: { status: "finished", detail: observableDetail },
				strength: "strong",
				replaceable: false,
			},
		}

		expect(() => act(() => forwardToolEvent?.(event))).not.toThrow()
		const forwardedMessage = postMessage.mock.calls[0]?.[0] as {
			event: ToolCallSettledEvent
		}
		expect(isObservable(forwardedMessage.event.payload.response.detail)).toBe(false)
		expect(forwardedMessage.event.payload.response.detail).toEqual({ refreshed: true })
	})
})
