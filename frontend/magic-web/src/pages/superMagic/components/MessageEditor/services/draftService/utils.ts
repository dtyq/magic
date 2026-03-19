import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { formatTime } from "@/utils/string"
import type { JSONContent } from "@tiptap/core"
import { userStore } from "@/models/user"
import { DraftKey } from "../../types"
import { isEqual } from "lodash-es"

// Check if data is meaningful (not empty) - only consider completed files
export const hasMeaningfulData = (data: {
	value?: JSONContent | null
	mentionItems?: MentionListItem[]
}) => {
	// Check if value has content (not just empty paragraphs)
	const hasContent =
		data.value &&
		data.value.content &&
		data.value.content.length > 0 &&
		data.value.content.some(
			(node) => node.type !== "paragraph" || (node.content && node.content.length > 0),
		)

	// Check if has mentions
	const hasMentions = (data.mentionItems || []).length > 0

	return hasContent || hasMentions
}

export const genDraftVersionId = (timestamp?: number) => {
	return formatTime((timestamp ?? Date.now()) / 1000, "YYYYMMDDHHmm")
}

/**
 * Generate unique key for draft
 */
export const generateKey = (draftKey: DraftKey): string => {
	const workspaceId = draftKey.workspaceId || "global"
	return `${userStore.user.userInfo?.organization_code}/${userStore.user.userInfo?.user_id}/${workspaceId}/${draftKey.projectId}:${draftKey.topicId}`
}

/**
 * Generate unique version key for draft version
 */
export const generateVersionKey = (draftKey: DraftKey, versionId: string): string => {
	const workspaceId = draftKey.workspaceId || "global"
	return `${userStore.user.userInfo?.organization_code}/${userStore.user.userInfo?.user_id}/${workspaceId}/${draftKey.projectId}:${draftKey.topicId}:${versionId}`
}

/** Legacy key without workspace dimension for backward compatibility */
export const generateLegacyKey = (draftKey: DraftKey): string => {
	return `${userStore.user.userInfo?.organization_code}/${userStore.user.userInfo?.user_id}/${draftKey.projectId}:${draftKey.topicId}`
}

/**
 * Check if the version data is the same as the latest version
 */
export const isEqualData = (
	versionData: {
		value?: JSONContent | null
		mentionItems?: MentionListItem[]
	},
	latestVersion: {
		value?: JSONContent | null
		mentionItems?: MentionListItem[]
	} | null,
) => {
	if (!latestVersion) {
		return false
	}

	return (
		isEqual(versionData.value, latestVersion?.value) &&
		isEqual(versionData.mentionItems, latestVersion?.mentionItems)
	)
}
