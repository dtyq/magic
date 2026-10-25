import { WIDGET_HEADER_ACTION_NAMES } from "./config"
import type { MagicWidget } from "./types"

export const WIDGET_PROTOCOL = "magic-widget"
export const WIDGET_PROTOCOL_VERSION = 1
export const WIDGET_QUERY_EMBED = "magicWidgetEmbed"
export const WIDGET_QUERY_INSTANCE_ID = "magicWidgetInstanceId"
export const WIDGET_QUERY_PROTOCOL_VERSION = "magicWidgetProtocolVersion"
export const WIDGET_QUERY_HOST_ORIGIN = "magicWidgetHostOrigin"
export const WIDGET_QUERY_RENDER_MODE = "magicWidgetRenderMode"
export const WIDGET_QUERY_DEPLOYMENT_CODE = "magicWidgetDeploymentCode"
export const WIDGET_QUERY_CONFIG = "magicWidgetConfig"
const HEADER_ACTIONS = new Set<MagicWidget.HeaderActionName>(WIDGET_HEADER_ACTION_NAMES)

export type WidgetCommandName =
	"setInput" | "appendInput" | "clearInput" | "getInput" | "sendMessage" | "newConversation"

export interface WidgetReadyMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	type: "ready"
	capabilities: WidgetCommandName[]
}

export interface WidgetCommandMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	requestId: string
	type: "command"
	command: WidgetCommandName
	payload?: { content?: MagicWidget.InputContent | string }
}

export interface WidgetResponseMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	requestId: string
	type: "response"
	ok: boolean
	/** Command payload, ownership ack, or a non-fatal config filtering diagnostic. */
	result?: {
		content?: string
		headerActionHandled?: boolean
		configWarning?: MagicWidget.ConfigWarning
		customMentionSearch?: MagicWidget.CustomMentionSearchResult[]
	}
	error?: { code: string; message: string }
}

/** Notifies the host after a header action. Built-in iframe behavior already completed; headerActionHandled is an ownership ack. */
export interface WidgetHeaderActionMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	requestId: string
	type: "header_action"
	action: MagicWidget.HeaderActionName
	context?: MagicWidget.HeaderActionContext
}

/** Requests host-owned custom Mention results for one active search scope. */
export interface WidgetMentionSearchMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	requestId: string
	type: "mention_search"
	query: string
	scope: MagicWidget.CustomMentionSearchContext["scope"]
}

/** Cancels an in-flight host-owned custom Mention search request. */
export interface WidgetMentionSearchCancelMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	requestId: string
	type: "mention_search_cancel"
}

export interface WidgetConfigMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	requestId: string
	type: "config"
	config: MagicWidget.WidgetConfig
}

export interface WidgetConfigReadyMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	type: "config_ready"
}

export interface WidgetUiStateMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	type: "ui_state"
	state: {
		previewFullscreen: boolean
	}
}

export interface WidgetUiCommandMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	type: "ui_command"
	command: "dismiss_preview"
}

/** Carries one validated SuperMagic runtime event from the iframe to its host. */
export interface WidgetRuntimeEventMessage {
	protocol: typeof WIDGET_PROTOCOL
	version: typeof WIDGET_PROTOCOL_VERSION
	instanceId: string
	type: "event"
	event: MagicWidget.RuntimeEvent
}

export type WidgetProtocolMessage =
	| WidgetReadyMessage
	| WidgetCommandMessage
	| WidgetConfigMessage
	| WidgetConfigReadyMessage
	| WidgetUiStateMessage
	| WidgetUiCommandMessage
	| WidgetRuntimeEventMessage
	| WidgetHeaderActionMessage
	| WidgetMentionSearchMessage
	| WidgetMentionSearchCancelMessage
	| WidgetResponseMessage

/** Checks that mention data has the object-shaped container required by the bridge. */
function isObjectRecord(value: unknown): value is MagicWidget.JsonObject {
	return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

/** Checks required text mention fields without restricting other JSON payload fields. */
function isTextMentionData(value: MagicWidget.JsonObject): boolean {
	return (
		typeof value.label === "string" &&
		value.label.trim().length > 0 &&
		typeof value.text === "string" &&
		value.text.trim().length > 0 &&
		typeof value.id === "string" &&
		value.id.trim().length > 0
	)
}

/** Validates the generic public mention shape while keeping business rules in Magic Web. */
function isInputMention(value: unknown): value is MagicWidget.InputMention {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false
	const mention = value as Record<string, unknown>
	if (typeof mention.type !== "string" || mention.type.trim().length === 0) return false
	if (!isObjectRecord(mention.data)) return false
	return mention.type === "text" ? isTextMentionData(mention.data) : true
}

/** Validates structured Widget blocks before they are converted into editor nodes. */
export function isWidgetInputContent(value: unknown): value is MagicWidget.InputContent {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false
	const content = value as Record<string, unknown>
	if (!Array.isArray(content.blocks) || content.blocks.length === 0) return false
	return content.blocks.every((block) => {
		if (!block || typeof block !== "object" || Array.isArray(block)) return false
		const blockRecord = block as Record<string, unknown>
		if (blockRecord.type === "text") {
			return typeof blockRecord.text === "string"
		}
		return blockRecord.type === "mention" && isInputMention(blockRecord.mention)
	})
}

/** Checks the minimal discriminated shape before the bridge exposes a runtime event. */
function isRuntimeEvent(value: unknown): value is MagicWidget.RuntimeEvent {
	if (!value || typeof value !== "object") return false
	const event = value as Record<string, unknown>
	return (
		event.type === "message.stream.started" ||
		event.type === "toolCall.settled" ||
		event.type === "task.completed"
	)
}

/** Checks the stable envelope before either side consumes a cross-window message. */
export function isWidgetProtocolMessage(value: unknown): value is WidgetProtocolMessage {
	if (!value || typeof value !== "object") return false
	const message = value as Record<string, unknown>
	const isKnownType =
		message.type === "ready" ||
		message.type === "command" ||
		message.type === "config" ||
		message.type === "config_ready" ||
		message.type === "ui_state" ||
		message.type === "ui_command" ||
		message.type === "response" ||
		(message.type === "header_action" &&
			typeof message.requestId === "string" &&
			typeof message.action === "string" &&
			HEADER_ACTIONS.has(message.action as MagicWidget.HeaderActionName)) ||
		(message.type === "mention_search" &&
			typeof message.requestId === "string" &&
			typeof message.query === "string" &&
			Boolean(message.scope) &&
			typeof message.scope === "object" &&
			((message.scope as Record<string, unknown>).type === "global" ||
				((message.scope as Record<string, unknown>).type === "group" &&
					typeof (message.scope as Record<string, unknown>).groupId === "string"))) ||
		(message.type === "mention_search_cancel" && typeof message.requestId === "string") ||
		(message.type === "event" && isRuntimeEvent(message.event))
	return (
		message.protocol === WIDGET_PROTOCOL &&
		message.version === WIDGET_PROTOCOL_VERSION &&
		typeof message.instanceId === "string" &&
		isKnownType
	)
}
