import { useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { userStore } from "@/models/user"
import { superMagicStore } from "@/pages/superMagic/stores"
import { optimisticMessageStore } from "@/pages/superMagic/stores/optimisticMessageStore"
import { isTopicTaskRunning } from "@/pages/superMagic/pages/Workspace/types"
import { platformKey } from "@/utils/storage"
import { usePersonaResearchStore } from "../context"
import {
	hasInterviewChatReply,
	isInterviewChatMessage,
	type InterviewChatRequest,
	type InterviewChatSend,
} from "../services/interviewChat"
import type { InterviewFile } from "../types"

interface ChatState {
	draft: string
	pending?: InterviewChatRequest
	failed?: boolean
}

function readState(key: string): ChatState {
	try {
		const state = JSON.parse(sessionStorage.getItem(key) || "null")
		return state && typeof state.draft === "string" ? state : { draft: "" }
	} catch {
		return { draft: "" }
	}
}

/** Mounted per account/project/topic/persona: tab switches and refreshes retain unsent text. */
export function useInterviewChat(transcript: InterviewFile, onSend: InterviewChatSend) {
	const store = usePersonaResearchStore()
	const user = userStore.user.userInfo
	const key = platformKey(
		`research-interview-chat/${user?.user_id}/${user?.organization_code}/${store.selectedProject?.id}/${store.selectedTopic?.id}/${transcript.persona_id}`,
	)
	const [state, setState] = useState(() => readState(key))
	const stateRef = useRef(state)
	const submittingRef = useRef(false)
	const [submitting, setSubmitting] = useState(false)
	const save = useMemoizedFn((next: ChatState) => {
		stateRef.current = next
		setState(next)
		try {
			sessionStorage.setItem(key, JSON.stringify(next))
		} catch {
			/* Storage is optional; sending still works. */
		}
	})
	const pending =
		state.pending && !hasInterviewChatReply(transcript, state.pending.id)
			? state.pending
			: undefined
	const topic = store.selectedTopic
	const messages = superMagicStore.messages?.get(topic?.chat_topic_id || "") || []
	const message = pending
		? messages.find((item) => {
				const node = superMagicStore.getMessageNode(item.super_message_id)
				return isInterviewChatMessage(node, pending.id)
			})
		: undefined
	const transportStatus =
		message?.app_message_id && topic?.chat_topic_id
			? optimisticMessageStore.getStatus(topic.chat_topic_id, message.app_message_id)
			: undefined
	const failed = Boolean(pending && (state.failed || transportStatus === "failed"))
	const status =
		submitting || transportStatus === "sending"
			? "sending"
			: failed
				? "failed"
				: message
					? store.isConversationGenerating || isTopicTaskRunning(topic)
						? "processing"
						: "unrecorded"
					: "queued"

	const send = useMemoizedFn(async () => {
		if (submittingRef.current || !topic || store.isReadOnly) return
		const persona = store.personas.find((item) => item.data.id === transcript.persona_id)
		const interview = store.interviews.find(
			(item) => item.data.persona_id === transcript.persona_id,
		)
		if (!persona || !interview || (!pending && !state.draft.trim())) return
		// Retrying keeps both the target and ID; a lost ACK cannot create a second persona answer.
		const request = pending ?? {
			id: `interview-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
			topicId: topic.id,
			personaId: transcript.persona_id,
			personaPath: persona.path,
			transcriptPath: interview.path,
			question: state.draft.trim(),
		}
		submittingRef.current = true
		setSubmitting(true)
		save({ ...state, pending: request, failed: false })
		try {
			const accepted = await onSend(request)
			save({
				draft:
					accepted && stateRef.current.draft.trim() === request.question
						? ""
						: stateRef.current.draft,
				pending: request,
				failed: !accepted,
			})
		} catch {
			save({ ...stateRef.current, failed: true })
		} finally {
			submittingRef.current = false
			setSubmitting(false)
		}
	})
	return {
		storageKey: key,
		draft: state.draft,
		setDraft: (draft: string) => save({ ...stateRef.current, draft }),
		pending,
		status,
		submitting,
		failed,
		canRetry: failed || status === "unrecorded",
		send,
	}
}
