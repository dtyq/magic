import type { RawMessage, SuperMagicChunkMessage } from "@/types/chat/intermediate_message"
import type { RawSuperMagicMessageSequence } from "./types"
import { db } from "./storage"

export function persistMessageToStorage(
	_topicId: string,
	_value: RawMessage | RawSuperMagicMessageSequence | SuperMagicChunkMessage,
	_debugMode?: boolean,
) {
	try {
		const cacheId = ("seq_id" in _value ? _value.seq_id : undefined) || `${performance.now()}`
		const parsedValue = JSON.parse(JSON.stringify(_value))
		db.addToTable(_topicId, `${cacheId}`, parsedValue)
	} catch (error) {
		console.log(error)
	}
}
