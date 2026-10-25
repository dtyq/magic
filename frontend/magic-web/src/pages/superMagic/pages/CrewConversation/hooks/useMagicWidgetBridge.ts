import { useEffect, useRef } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useMemoizedFn } from "ahooks"
import { isObservable, toJS } from "mobx"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { SuperMagicWidgetEditorCommandName } from "@/pages/superMagic/events/message"
import { superMagicStore } from "@/pages/superMagic/stores"
import type { MagicWidget } from "@magic-web/widget-sdk"
import type {
	MessageStreamStartedEvent,
	TaskCompletedEvent,
	ToolCallSettledEvent,
} from "@/pages/superMagic/stores"

const PROTOCOL = "magic-widget"
const VERSION = 1
const AGENT_READY_TIMEOUT_MS = 20_000
const EDITOR_COMMAND_TIMEOUT_MS = 2_000
const HEADER_ACTION_TIMEOUT_MS = 10_000
const CAPABILITIES = [
	"setInput",
	"appendInput",
	"clearInput",
	"getInput",
	"sendMessage",
	"newConversation",
] as const

type WidgetCommandName = (typeof CAPABILITIES)[number]

interface WidgetContext {
	instanceId: string
	hostOrigin: string
}

interface AgentReadyWaiter {
	afterSequence: number
	resolve: () => void
	reject: (error: Error) => void
	timer: number
}

interface HeaderActionWaiter {
	resolve: (handled: boolean) => void
	reject: (error: Error) => void
	timer: number
}

interface UseMagicWidgetBridgeOptions {
	context: WidgetContext | null
	createNewConversation: () => Promise<Topic | null>
}

export interface MagicWidgetBridgeController {
	notifyAgentReady: () => void
	requestHeaderAction: (
		action: MagicWidget.HeaderActionName,
		context?: Omit<MagicWidget.HeaderActionContext, "action">,
	) => Promise<boolean>
}

/** Converts public text into the internal plain-text TipTap document contract. */
function createTextContent(content: string): JSONContent {
	return {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
	}
}

/** Converts validated SDK blocks into the internal TipTap mention node contract. */
function createWidgetContent(content: string | MagicWidget.InputContent): JSONContent {
	if (typeof content === "string") return createTextContent(content)

	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: content.blocks.map((block) =>
					block.type === "text"
						? { type: "text", text: block.text }
						: {
								type: "mention",
								attrs: {
									type: block.mention.type,
									data: block.mention.data,
								},
							},
				),
			},
		],
	}
}

/** Validates SDK mention data while leaving business rules to Magic Web. */
function isWidgetMention(value: unknown): value is MagicWidget.InputMention {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false
	const mention = value as Record<string, unknown>
	if (typeof mention.type !== "string" || mention.type.trim().length === 0) return false
	if (!mention.data || typeof mention.data !== "object" || Array.isArray(mention.data)) {
		return false
	}
	if (mention.type !== "text") return true
	const data = mention.data as Record<string, unknown>
	return (
		typeof data.label === "string" &&
		data.label.trim().length > 0 &&
		typeof data.text === "string" &&
		data.text.trim().length > 0 &&
		typeof data.id === "string" &&
		data.id.trim().length > 0
	)
}

/** Validates the SDK-only block contract without accepting raw TipTap JSON. */
function isWidgetInputContent(value: unknown): value is MagicWidget.InputContent {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false
	const content = value as Record<string, unknown>
	if (!Array.isArray(content.blocks) || content.blocks.length === 0) return false
	return content.blocks.every((block) => {
		if (!block || typeof block !== "object" || Array.isArray(block)) return false
		const blockRecord = block as Record<string, unknown>
		if (blockRecord.type === "text") {
			return typeof blockRecord.text === "string"
		}
		return blockRecord.type === "mention" && isWidgetMention(blockRecord.mention)
	})
}

/** Revalidates cross-window input before any content reaches the editor or send flow. */
function parseWidgetContent(value: unknown): string | MagicWidget.InputContent {
	if (typeof value === "string" && value.trim()) return value
	if (isWidgetInputContent(value)) return value
	throw new Error("Widget command content must use valid text and mention blocks")
}

/** Converts observable event branches into plain values accepted by structured cloning. */
function createCloneableRuntimeValue(value: unknown): unknown {
	if (!value || typeof value !== "object") return value

	const snapshot = isObservable(value) ? toJS(value) : value
	if (Array.isArray(snapshot)) {
		return snapshot.map((item) => createCloneableRuntimeValue(item))
	}

	const prototype = Object.getPrototypeOf(snapshot)
	if (prototype !== Object.prototype && prototype !== null) return snapshot

	return Object.fromEntries(
		Object.entries(snapshot as Record<string, unknown>).map(([key, item]) => [
			key,
			createCloneableRuntimeValue(item),
		]),
	)
}

/** Bridges approved Widget commands into the Crew editor and conversation store. */
export function useMagicWidgetBridge({
	context,
	createNewConversation,
}: UseMagicWidgetBridgeOptions): MagicWidgetBridgeController {
	const readySequenceRef = useRef(0)
	const readyWaitersRef = useRef(new Set<AgentReadyWaiter>())
	const readyAfterWindowLoadRef = useRef(false)
	const pendingWindowLoadListenerRef = useRef<(() => void) | null>(null)
	const headerActionSequenceRef = useRef(0)
	const headerActionWaitersRef = useRef(new Map<string, HeaderActionWaiter>())

	/** Resolves once an editor ready notification newer than the provided sequence arrives. */
	const waitForAgentReadyAfter = useMemoizedFn(
		(afterSequence: number, timeoutMs = AGENT_READY_TIMEOUT_MS): Promise<void> => {
			if (readySequenceRef.current > afterSequence) return Promise.resolve()

			return new Promise((resolve, reject) => {
				const waiter: AgentReadyWaiter = {
					afterSequence,
					resolve,
					reject,
					timer: 0,
				}
				waiter.timer = window.setTimeout(() => {
					readyWaitersRef.current.delete(waiter)
					reject(new Error("Magic widget editor did not become ready"))
				}, timeoutMs)
				readyWaitersRef.current.add(waiter)
			})
		},
	)

	/** Sends the protocol READY message and releases new-conversation readiness waiters. */
	const emitAgentReady = useMemoizedFn(() => {
		if (!context || window.parent === window) return
		readySequenceRef.current += 1
		window.parent.postMessage(
			{
				protocol: PROTOCOL,
				version: VERSION,
				instanceId: context.instanceId,
				type: "ready",
				capabilities: [...CAPABILITIES],
			},
			context.hostOrigin,
		)

		readyWaitersRef.current.forEach((waiter) => {
			if (readySequenceRef.current <= waiter.afterSequence) return
			window.clearTimeout(waiter.timer)
			readyWaitersRef.current.delete(waiter)
			waiter.resolve()
		})
	})

	/** Sends agent_ready after both the editor and the current iframe document are fully loaded. */
	const notifyAgentReady = useMemoizedFn(() => {
		if (document.readyState === "complete") {
			emitAgentReady()
			return
		}
		if (readyAfterWindowLoadRef.current) return

		readyAfterWindowLoadRef.current = true
		const handleWindowLoad = () => {
			readyAfterWindowLoadRef.current = false
			pendingWindowLoadListenerRef.current = null
			emitAgentReady()
		}
		pendingWindowLoadListenerRef.current = handleWindowLoad
		window.addEventListener("load", handleWindowLoad, { once: true })
	})

	/** Executes one editor maintenance command and waits for its synchronous adapter response. */
	const executeEditorCommand = useMemoizedFn(
		(
			command: SuperMagicWidgetEditorCommandName,
			content?: string | JSONContent,
		): Promise<string | undefined> => {
			return new Promise((resolve, reject) => {
				const timer = window.setTimeout(() => {
					reject(new Error("Magic widget editor command was not handled"))
				}, EDITOR_COMMAND_TIMEOUT_MS)

				pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
					command,
					content,
					respond: (result, error) => {
						window.clearTimeout(timer)
						if (error) {
							reject(new Error(error))
							return
						}
						resolve(result)
					},
				})
			})
		},
	)

	/** Notifies the host of a header action and returns the ownership ack. The iframe does not fall back. */
	const requestHeaderAction = useMemoizedFn(
		(
			action: MagicWidget.HeaderActionName,
			actionContext?: Omit<MagicWidget.HeaderActionContext, "action">,
		): Promise<boolean> => {
			if (!context || window.parent === window) return Promise.resolve(false)
			headerActionSequenceRef.current += 1
			const requestId = `header-action-${headerActionSequenceRef.current}`
			return new Promise((resolve, reject) => {
				const waiter: HeaderActionWaiter = { resolve, reject, timer: 0 }
				waiter.timer = window.setTimeout(() => {
					headerActionWaitersRef.current.delete(requestId)
					reject(new Error("Magic widget header action timed out"))
				}, HEADER_ACTION_TIMEOUT_MS)
				headerActionWaitersRef.current.set(requestId, waiter)
				window.parent.postMessage(
					{
						protocol: PROTOCOL,
						version: VERSION,
						instanceId: context.instanceId,
						requestId,
						type: "header_action",
						action,
						context: { action, ...actionContext },
					},
					context.hostOrigin,
				)
			})
		},
	)

	useEffect(() => {
		if (!context || window.parent === window) return
		const targetOrigin = context.hostOrigin

		/** Forwards one Store runtime event without adding topic filters or changing its payload. */
		const forwardRuntimeEvent = (
			event: MessageStreamStartedEvent | ToolCallSettledEvent | TaskCompletedEvent,
		) => {
			const cloneableEvent = createCloneableRuntimeValue(event)
			window.parent.postMessage(
				{
					protocol: PROTOCOL,
					version: VERSION,
					instanceId: context.instanceId,
					type: "event",
					event: cloneableEvent,
				},
				targetOrigin,
			)
		}
		const unsubscribeToolCallSettled = superMagicStore.subscribe(
			"toolCall.settled",
			forwardRuntimeEvent,
		)
		const unsubscribeTaskCompleted = superMagicStore.subscribe(
			"task.completed",
			forwardRuntimeEvent,
		)
		const unsubscribeMessageStreamStarted = superMagicStore.subscribe(
			"message.stream.started",
			forwardRuntimeEvent,
		)

		/** Sends one correlated response back to the bound host window. */
		const respond = (
			requestId: string,
			ok: boolean,
			options?: { error?: string; content?: string },
		) => {
			window.parent.postMessage(
				{
					protocol: PROTOCOL,
					version: VERSION,
					instanceId: context.instanceId,
					requestId,
					type: "response",
					ok,
					result:
						options?.content === undefined ? undefined : { content: options.content },
					error: options?.error
						? { code: "COMMAND_FAILED", message: options.error }
						: undefined,
				},
				targetOrigin,
			)
		}

		/** Validates and executes one command without exposing internal editor structures. */
		const executeCommand = async (event: MessageEvent) => {
			const requestId = event.data.requestId as string
			const command = event.data.command as WidgetCommandName

			try {
				if (command === "setInput" || command === "appendInput") {
					const content = parseWidgetContent(event.data.payload?.content)
					await executeEditorCommand(command, createWidgetContent(content))
					respond(requestId, true)
					return
				}

				if (command === "sendMessage") {
					const rawContent = event.data.payload?.content
					if (rawContent === undefined) {
						if (!pubsub.hasListeners(PubSubEvents.Magic_Widget_Editor_Command)) {
							throw new Error("Magic widget editor sending is not available")
						}
						await executeEditorCommand("sendMessage")
					} else {
						if (!pubsub.hasListeners(PubSubEvents.Send_Message_by_Content)) {
							throw new Error("Magic widget message sending is not available")
						}
						const content = parseWidgetContent(rawContent)
						pubsub.publish(PubSubEvents.Send_Message_by_Content, {
							jsonContent: createWidgetContent(content),
							// Parameterized SDK sends must not replace or clear the current editor draft.
							shouldClearEditorAfterSend: false,
						})
					}
					respond(requestId, true)
					return
				}

				if (command === "clearInput") {
					await executeEditorCommand("clearInput")
					respond(requestId, true)
					return
				}

				if (command === "getInput") {
					const content = await executeEditorCommand("getInput")
					respond(requestId, true, { content: content ?? "" })
					return
				}

				if (command === "newConversation") {
					const previousReadySequence = readySequenceRef.current
					const newTopic = await createNewConversation()
					if (!newTopic?.id) throw new Error("Failed to create a new conversation")
					await waitForAgentReadyAfter(previousReadySequence)
					respond(requestId, true)
					return
				}

				throw new Error("Widget command name is invalid")
			} catch (error) {
				respond(requestId, false, {
					error: error instanceof Error ? error.message : "Widget command failed",
				})
			}
		}

		/** Rejects messages outside the bound protocol, origin, instance, and parent window. */
		const handleMessage = (event: MessageEvent) => {
			if (
				event.origin !== targetOrigin ||
				event.source !== window.parent ||
				!event.data ||
				event.data.protocol !== PROTOCOL ||
				event.data.version !== VERSION ||
				event.data.instanceId !== context.instanceId
			) {
				return
			}

			if (event.data.type === "response" && typeof event.data.requestId === "string") {
				const waiter = headerActionWaitersRef.current.get(event.data.requestId)
				if (!waiter) return
				window.clearTimeout(waiter.timer)
				headerActionWaitersRef.current.delete(event.data.requestId)
				if (event.data.ok) {
					waiter.resolve(event.data.result?.headerActionHandled === true)
				} else {
					waiter.reject(
						new Error(event.data.error?.message ?? "Magic widget header action failed"),
					)
				}
				return
			}

			if (
				event.data.type !== "command" ||
				typeof event.data.requestId !== "string" ||
				!CAPABILITIES.includes(event.data.command)
			) {
				return
			}

			void executeCommand(event)
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
			unsubscribeToolCallSettled()
			unsubscribeTaskCompleted()
			unsubscribeMessageStreamStarted()
		}
	}, [context, createNewConversation, executeEditorCommand, waitForAgentReadyAfter])

	useEffect(() => {
		const readyWaiters = readyWaitersRef.current
		const headerActionWaiters = headerActionWaitersRef.current
		return () => {
			if (pendingWindowLoadListenerRef.current) {
				window.removeEventListener("load", pendingWindowLoadListenerRef.current)
				pendingWindowLoadListenerRef.current = null
			}
			readyAfterWindowLoadRef.current = false
			const error = new Error("Magic widget bridge was destroyed")
			readyWaiters.forEach((waiter) => {
				window.clearTimeout(waiter.timer)
				waiter.reject(error)
			})
			readyWaiters.clear()
			headerActionWaiters.forEach((waiter) => {
				window.clearTimeout(waiter.timer)
				waiter.reject(error)
			})
			headerActionWaiters.clear()
		}
	}, [])

	return { notifyAgentReady, requestHeaderAction }
}
