import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import i18n from "i18next"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SelfMediaPlatform } from "../../../types"
import { ALL_PLATFORMS } from "../components/SelfMediaInitPanel/types"
import type { SelfMediaPost } from "../types"
import { SELF_MEDIA_TOPIC_PATTERN } from "./selfMediaBatchSend"

export type SelfMediaPrePublishAnalysisGoal = "ip-growth" | "conversion" | "viral-traffic"
export const SELF_MEDIA_PRE_PUBLISH_TOPIC_PATTERN = SELF_MEDIA_TOPIC_PATTERN

export const SELF_MEDIA_PRE_PUBLISH_ANALYSIS_GOALS: Array<{
	value: SelfMediaPrePublishAnalysisGoal
	labelKey: string
	descriptionKey: string
}> = [
	{
		value: "ip-growth",
		labelKey: "detail.selfMedia.analysis.goals.ipGrowth",
		descriptionKey: "detail.selfMedia.analysis.goalDescriptions.ipGrowth",
	},
	{
		value: "conversion",
		labelKey: "detail.selfMedia.analysis.goals.conversion",
		descriptionKey: "detail.selfMedia.analysis.goalDescriptions.conversion",
	},
	{
		value: "viral-traffic",
		labelKey: "detail.selfMedia.analysis.goals.viralTraffic",
		descriptionKey: "detail.selfMedia.analysis.goalDescriptions.viralTraffic",
	},
]

const I18N_NS = "super"

const ANALYSIS_GOAL_FALLBACK_LABELS: Record<SelfMediaPrePublishAnalysisGoal, string> = {
	"ip-growth": "IP Growth",
	conversion: "Product Conversion",
	"viral-traffic": "Viral Traffic",
}

function para(text: string): JSONContent {
	return {
		type: "paragraph",
		content: text ? [{ type: "text", text }] : [],
	}
}

function paraNodes(content: JSONContent[]): JSONContent {
	return {
		type: "paragraph",
		content,
	}
}

function folderMentionNode(item: AttachmentItem): JSONContent {
	const mention = buildFolderMention(item)
	return {
		type: "mention",
		attrs: {
			id: null,
			label: null,
			mentionSuggestionChar: "@",
			type: mention.type,
			data: mention.data,
		},
	}
}

function paraWithMentionTemplate(template: string, mention: JSONContent): JSONContent {
	const placeholder = "{{mention}}"
	const index = template.indexOf(placeholder)
	if (index === -1) {
		return paraNodes([{ type: "text", text: template }, { type: "text", text: " " }, mention])
	}

	const before = template.slice(0, index)
	const after = template.slice(index + placeholder.length)
	const content: JSONContent[] = []
	if (before) content.push({ type: "text", text: before })
	content.push(mention)
	if (after) content.push({ type: "text", text: after })
	return paraNodes(content)
}

function t(key: string, defaultValue: string, values?: Record<string, unknown>): string {
	return String(
		i18n.t(key, {
			ns: I18N_NS,
			defaultValue,
			...values,
		}),
	)
}

function platformLabel(platform: SelfMediaPlatform): string {
	const platformOption = ALL_PLATFORMS.find((item) => item.value === platform)
	if (!platformOption) return platform
	return t(platformOption.labelKey, platform)
}

function analysisGoalLabel(goal: SelfMediaPrePublishAnalysisGoal): string {
	const option = SELF_MEDIA_PRE_PUBLISH_ANALYSIS_GOALS.find((item) => item.value === goal)
	return t(option?.labelKey || "", ANALYSIS_GOAL_FALLBACK_LABELS[goal])
}

function titleOf(post: SelfMediaPost): string {
	return (
		post.meta.feedTitle ||
		post.meta.title ||
		post.meta.id ||
		t("detail.selfMedia.analysis.prompt.untitled", "Self-media post")
	)
}

export function buildSelfMediaPrePublishAnalysisContent({
	platform,
	analysisGoal,
	post,
	postDirectoryItem,
}: {
	platform: SelfMediaPlatform
	analysisGoal: SelfMediaPrePublishAnalysisGoal
	post: SelfMediaPost
	postDirectoryItem: AttachmentItem
}): JSONContent {
	const goalLabel = analysisGoalLabel(analysisGoal)
	const meta = post.meta || { id: "" }
	const missingValue = t("detail.selfMedia.analysis.prompt.missingValue", "Not provided")

	return {
		type: "doc",
		content: [
			paraWithMentionTemplate(
				t(
					"detail.selfMedia.analysis.prompt.opening",
					"Diagnose {{mention}} before publishing.",
				),
				folderMentionNode(postDirectoryItem),
			),
			para(
				t(
					"detail.selfMedia.analysis.prompt.metadata",
					"Platform: {{platform}}\nGoal: {{goal}}\nTitle: {{title}}\nAuthor/IP: {{author}}\nTags: {{tags}}",
					{
						platform: platformLabel(platform),
						goal: goalLabel,
						title: titleOf(post),
						author: meta.author || missingValue,
						tags: meta.tags || missingValue,
					},
				),
			),
			para(
				t(
					"detail.selfMedia.analysis.prompt.instruction",
					"Search online for comparable content. Output evidence, score, key issues, comparison gaps, prioritized edits, and rewrite instructions. Treat external references as operational experience, not platform rules.",
				),
			),
		],
	}
}

function buildFolderMention(item: AttachmentItem) {
	return {
		type: MentionItemType.FOLDER,
		data: getFolderMentionData({
			directoryId: item.file_id,
			directoryName: item.file_name || item.filename || item.display_filename,
			directoryPath: item.relative_file_path,
			directoryMetadata: item.display_config,
		}),
	}
}

export interface SendSelfMediaPrePublishAnalysisParams {
	selectedProject: { id: string } | null | undefined
	platform: SelfMediaPlatform
	analysisGoal: SelfMediaPrePublishAnalysisGoal
	selectedModel?: ModelItem | null
	post: SelfMediaPost
	postDirectoryItem: AttachmentItem
}

export async function sendSelfMediaPrePublishAnalysis({
	selectedProject,
	platform,
	analysisGoal,
	selectedModel,
	post,
	postDirectoryItem,
}: SendSelfMediaPrePublishAnalysisParams) {
	if (!selectedProject?.id) throw new Error("No project selected")

	const topicName = t(
		"detail.selfMedia.analysis.prompt.topicName",
		"[Pre-publish diagnosis] {{title}}",
		{
			title: titleOf(post),
		},
	)

	const content = buildSelfMediaPrePublishAnalysisContent({
		platform,
		analysisGoal,
		post,
		postDirectoryItem,
	})
	const topicMode = SELF_MEDIA_TOPIC_PATTERN as unknown as TopicMode

	pubsub.publish(PubSubEvents.Create_New_Topic, {
		topicMode,
		topicName,
		afterCreate: {
			content,
			send: true,
			topicMode,
			selectedModel,
			extra: {
				super_agent: {
					topic_pattern: SELF_MEDIA_TOPIC_PATTERN,
					chat_mode: "normal",
					enable_web_search: true,
					dynamic_params: {
						message_version: "v2",
					},
				},
			},
		},
	})
}
