import { SuperMagicApi } from "@/apis"
import type { Topic } from "../pages/Workspace/types"

export interface SmartRenameTopicParams {
	topicId: string
	userQuestion: string
	updateTopicName?: (topicId: string, topicName: string) => void | Promise<void>
}

export interface SmartRenameTopicIfUnnamedParams {
	topic: Topic | null | undefined
	userQuestion: string
	updateTopicName?: (topicId: string, topicName: string) => void | Promise<void>
}

export async function smartRenameTopic({
	topicId,
	userQuestion,
	updateTopicName,
}: SmartRenameTopicParams): Promise<string | null> {
	const trimmedQuestion = userQuestion.trim()
	if (!topicId || !trimmedQuestion) return null

	try {
		const res = await SuperMagicApi.smartTopicRename({
			id: topicId,
			user_question: trimmedQuestion,
		})
		const topicName = res.topic_name?.trim()
		if (!topicName) return null

		await updateTopicName?.(topicId, topicName)
		return topicName
	} catch (error) {
		console.error("AI rename topic failed:", error)
		return null
	}
}

export async function smartRenameTopicIfUnnamed({
	topic,
	userQuestion,
	updateTopicName,
}: SmartRenameTopicIfUnnamedParams): Promise<string | null> {
	if (!topic?.id) return null
	if (topic.topic_name.trim()) return null

	return smartRenameTopic({
		topicId: topic.id,
		userQuestion,
		updateTopicName,
	})
}
