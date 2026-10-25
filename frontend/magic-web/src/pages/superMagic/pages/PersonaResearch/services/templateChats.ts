import { z } from "zod"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { TaskStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import { getAttachmentPath, listLibraryFiles } from "./researchFiles"

/**
 * Report template conversations ("create / edit a template with AI") are ordinary research
 * topics that never write a study.json, so nothing on the topic tells them apart. When the
 * first message is sent the page writes one marker per conversation:
 *
 *   template-chats/<topic_id>.json
 *   { schema_version: 1, topic_id, mode: "create" | "edit", template_path?, templates_before,
 *     started_at, prompt? }
 *
 * The marker lives in the project, so the conversation can be found again after closing the
 * panel, a refresh, or on another device. templates_before (path → version) tells whether the
 * conversation has produced or changed a template yet; prompt (the first message) lets a message
 * that never went out be sent again.
 */
export const TEMPLATE_CHATS_DIR = "template-chats/"

/**
 * Topic ids of template conversations, read from marker file names so no content is needed.
 * Example: [template-chats/971.json, personas/p1.json] → {"971"}.
 */
export function templateChatTopicIds(list: AttachmentItem[]): Set<string> {
	return new Set(
		listLibraryFiles(list, TEMPLATE_CHATS_DIR).map((item) =>
			getAttachmentPath(item)
				.slice(TEMPLATE_CHATS_DIR.length)
				.replace(/\.json$/i, ""),
		),
	)
}

/**
 * Template conversations started before markers existed: no study.json and a topic name about a
 * report template, as the agent names them. Example: "新建儿童涂鸦风报告模板" → true;
 * "高校二手书付费意愿" → false. Only for topics without a study directory.
 */
export function isLegacyTemplateChatName(topicName: string | undefined | null): boolean {
	return /报告模板|report template/i.test(topicName ?? "")
}

const markerSchema = z.object({
	schema_version: z.literal(1),
	topic_id: z.string().min(1),
	mode: z.enum(["create", "edit"]),
	template_path: z.string().optional().catch(undefined),
	templates_before: z.record(z.string(), z.string()).catch({}),
	started_at: z.string().catch(""),
	/** The first message as editor content, so mentions survive a resend. */
	prompt: z.record(z.string(), z.unknown()).optional().catch(undefined),
})

export type TemplateChatMarker = z.infer<typeof markerSchema>

export function parseTemplateChatMarker(text: unknown): TemplateChatMarker | null {
	if (typeof text !== "string") return null
	try {
		const parsed = markerSchema.safeParse(JSON.parse(text))
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

export function serializeTemplateChatMarker(marker: TemplateChatMarker): string {
	return `${JSON.stringify(marker, null, 2)}\n`
}

/**
 * Where a template conversation stands, from its topic status and the template library.
 *
 * | State      | When                                                         |
 * | generating | the task is running, or queued for at most 2 minutes after sending |
 * | waiting    | the AI asked a question                                      |
 * | failed     | the task errored                                             |
 * | unsent     | still queued 2 minutes after sending: the first message never   |
 * |            | reached the AI (for example a dropped connection)             |
 * | stopped    | finished or stopped without any template added or changed    |
 * | done       | finished and a template was added or changed: the card goes, |
 * |            | the template card in the grid takes its place                |
 *
 * Example: create chat started with {voices.html: v1}; it finishes and brand.html appears → done.
 */
export type TemplateChatState = "generating" | "waiting" | "failed" | "unsent" | "stopped" | "done"

/** A queued task normally starts within seconds; past this it never got the message. */
const QUEUED_GRACE_MS = 2 * 60 * 1000

export function resolveTemplateChatState(
	marker: Pick<TemplateChatMarker, "templates_before" | "started_at">,
	topic: Pick<Topic, "task_status" | "status">,
	templates: { path: string; version: string }[],
	now = Date.now(),
): TemplateChatState {
	const status = topic.task_status || topic.status
	if (status === TaskStatus.RUNNING) return "generating"
	if (status === TaskStatus.WAITING || !status) {
		const startedAt = Date.parse(marker.started_at)
		if (Number.isNaN(startedAt) || now - startedAt < QUEUED_GRACE_MS) return "generating"
		return "unsent"
	}
	if (status === TaskStatus.WAITING_FOR_USER) return "waiting"
	if (status === TaskStatus.ERROR) return "failed"
	const produced = templates.some(
		(template) => marker.templates_before[template.path] !== template.version,
	)
	return produced ? "done" : "stopped"
}
