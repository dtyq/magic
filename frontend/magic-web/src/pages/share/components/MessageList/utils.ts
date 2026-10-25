import { superMagicStore } from "@/pages/superMagic/stores"

interface SharedSuperMagicMessage extends Record<string, unknown> {
	app_message_id?: string | null
	content?: unknown
	reasoning_content?: unknown
	role?: string | null
	status?: string | null
	super_message_id?: string | null
	tool_calls?: unknown
	topic_id?: string | null
}

interface SharedMessageSource extends Record<string, unknown> {
	correlation_id?: string | null
	event?: string | null
	message_id?: string
	raw_content?: {
		rich_text?: Record<string, unknown>
		super_magic_message?: SharedSuperMagicMessage
	}
	role?: string | null
	send_timestamp?: number | null
	status?: string | null
	topic_id?: string | null
	type?: string
}

function resolveSharedSuperMessageId(
	message: SharedMessageSource,
	rawSuperMagicMessage?: SharedSuperMagicMessage,
): string {
	const messageId = String(message?.message_id || "").trim()
	if (message?.type !== "super_magic_message") return messageId

	const appMessageId = String(rawSuperMagicMessage?.app_message_id || messageId).trim()
	// Keep the share projection on the exact identity used by loadSharedMessages/messageMap.
	return String(
		rawSuperMagicMessage?.role === "user"
			? appMessageId
			: rawSuperMagicMessage?.super_message_id || appMessageId,
	).trim()
}

/**
 * @description 数据来源于IM表，在客户端需要将数据磨平差异
 * @param messages 消息列表（IM表数据格式）
 */
export function messagesTransformer(messages: Array<SharedMessageSource>) {
	superMagicStore.loadSharedMessages(messages)
	return (messages || [])?.map((o) => {
		let role = o?.role
		const rawSuperMagicMessage = o?.raw_content?.super_magic_message
		const superMessageId = resolveSharedSuperMessageId(o, rawSuperMagicMessage)
		const imStatus = String(o?.status || "")

		if (o?.type === "super_magic_message") {
			role = rawSuperMagicMessage?.role
		}
		return {
			...o,
			magic_message_id: o?.message_id,
			app_message_id: o?.message_id,
			super_message_id: superMessageId,
			topic_id: o?.topic_id || rawSuperMagicMessage?.topic_id,
			type: o?.type,
			send_time: o?.send_timestamp,
			status: imStatus,
			imStatus,
			superStatus:
				role === "user"
					? undefined
					: String(rawSuperMagicMessage?.status || "") || undefined,
			event: o?.event,
			/**
			 * The IM envelope nests the SuperMagic payload under `raw_content[type]`, but every
			 * downstream consumer reads it from the item's top level, which is where
			 * `syncAssistantCardProjection` publishes it for live topics. Leaving it nested makes
			 * an Assistant turn look like an empty row carrying an IM-level `status` of "read",
			 * and the virtual projection drops it as unrenderable. `debug` has the same origin
			 * story: it is the canonical node everywhere else, and the old `o[o.type]` lookup
			 * searched the envelope top level, where the payload has never sat.
			 */
			content: rawSuperMagicMessage?.content ?? o?.content,
			reasoning_content: rawSuperMagicMessage?.reasoning_content ?? o?.reasoning_content,
			tool_calls: rawSuperMagicMessage?.tool_calls ?? o?.tool_calls,
			debug: rawSuperMagicMessage,
			correlation_id: o?.correlation_id,
			role: role || "user",
			seq_id: o?.message_id,
		}
	})
}
