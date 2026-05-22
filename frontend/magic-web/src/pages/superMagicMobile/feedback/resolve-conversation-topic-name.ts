import i18next from "i18next"

import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"

/**
 * Resolve display name for conversation feedback title prefill (话题名 → 项目名 → 未命名).
 */
export function resolveConversationTopicName(
	topic: Topic | null,
	project: ProjectListItem | null,
): string {
	const t = i18next.getFixedT(i18next.language, "super")
	return topic?.topic_name?.trim() || project?.project_name?.trim() || t("chat.unnamedChat")
}
