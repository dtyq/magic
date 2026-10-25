import type { InterviewFile } from "../types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { MentionItemType } from "@/components/business/MentionPanel/types"

export interface InterviewChatRequest {
	id: string
	topicId: string
	personaId: string
	personaPath: string
	transcriptPath: string
	question: string
}

export type InterviewChatSend = (request: InterviewChatRequest) => Promise<boolean>

/** Identity and the exact user message travel together through the existing send/queue flow. */
export function interviewChatPrompt(request: InterviewChatRequest): string {
	return [
		"Interview follow-up context (one user-initiated chat turn):",
		JSON.stringify(request),
		"Read the specified existing interview and persona. Call persona_chat once with exactly this question, persona_paths=[personaPath], transcript_path=transcriptPath, the next round_number, and follow_up_request_id=id. Never generate the participant's answer yourself. On a retry, reuse this ID and read the recorded answer instead of asking again. Do not run automatic interview questions, finish_persona_transcript, or update the study, synthesis, or report. Reply briefly in the user's language after the answer has been recorded. If the tool fails, report the failure; do not invent an answer.",
	].join("\n\n")
}

/** Existing text mentions separate the readable label from model context, including queue replay. */
export function interviewChatContent(request: InterviewChatRequest, name: string): JSONContent {
	const context = interviewChatPrompt(request)
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{
						type: "mention",
						attrs: {
							type: MentionItemType.TEXT,
							label: context,
							data: { id: request.id, label: name, text: context },
						},
					},
					{ type: "text", text: ` ${request.question}` },
				],
			},
		],
	}
}

/** Only the structured user-message reference identifies a send, never an assistant quoting its ID. */
export function isInterviewChatMessage(node: unknown, requestId: string): boolean {
	if (!node || typeof node !== "object" || !("content" in node)) return false
	if (typeof node.content !== "string" || !node.content.includes(requestId)) return false
	try {
		const doc = JSON.parse(node.content) as JSONContent
		return Boolean(
			doc.content?.some((paragraph) =>
				paragraph.content?.some(
					(item) =>
						item.type === "mention" &&
						item.attrs?.type === MentionItemType.TEXT &&
						item.attrs?.data?.id === requestId,
				),
			),
		)
	} catch {
		return false
	}
}

/** Match by durable request identity, never by text (two identical questions can be intentional). */
export function hasInterviewChatReply(transcript: InterviewFile, requestId: string): boolean {
	return transcript.rounds.some(
		(round) => round.request_id === requestId && (round.speaker ?? round.role) === "persona",
	)
}
