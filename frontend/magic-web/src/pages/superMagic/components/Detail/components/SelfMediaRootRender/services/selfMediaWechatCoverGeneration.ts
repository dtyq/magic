import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import i18n from "i18next"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SelfMediaPost, SelfMediaWechatCoverType } from "../types"
import { SELF_MEDIA_TOPIC_PATTERN } from "./selfMediaBatchSend"
import {
	buildFolderMention,
	buildFolderMentionItem,
	titleOf,
} from "./selfMediaPostPublishDataRefresh"

const I18N_NS = "super"

function t(key: string, defaultValue: string, values?: Record<string, unknown>): string {
	return String(
		i18n.t(key, {
			ns: I18N_NS,
			defaultValue,
			...values,
		}),
	)
}

function paragraph(content: JSONContent[]): JSONContent {
	return { type: "paragraph", content }
}

function textParagraph(text: string): JSONContent {
	return paragraph(text ? [{ type: "text", text }] : [])
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

function openingParagraph(template: string, item: AttachmentItem): JSONContent {
	const placeholder = "{{mention}}"
	const index = template.indexOf(placeholder)
	const mention = folderMentionNode(item)
	if (index === -1) {
		return paragraph([{ type: "text", text: `${template} ` }, mention])
	}

	const content: JSONContent[] = []
	const before = template.slice(0, index)
	const after = template.slice(index + placeholder.length)
	if (before) content.push({ type: "text", text: before })
	content.push(mention)
	if (after) content.push({ type: "text", text: after })
	return paragraph(content)
}

function coverTypeLabels(coverTypes: SelfMediaWechatCoverType[]): string {
	return coverTypes
		.map((coverType) =>
			coverType === "heroCover"
				? t(
						"detail.selfMedia.coverGeneration.prompt.heroCover",
						"21:9 horizontal cover (heroCover)",
					)
				: t(
						"detail.selfMedia.coverGeneration.prompt.thumbnailCover",
						"1:1 square cover (thumbnailCover)",
					),
		)
		.join(", ")
}

export function buildSelfMediaWechatCoverGenerationContent({
	post,
	postDirectoryItem,
	coverTypes,
}: {
	post: SelfMediaPost
	postDirectoryItem: AttachmentItem
	coverTypes: SelfMediaWechatCoverType[]
}): JSONContent {
	return {
		type: "doc",
		content: [
			openingParagraph(
				t(
					"detail.selfMedia.coverGeneration.prompt.opening",
					"Load and execute the self-media-composer Skill to generate missing WeChat cover images for {{mention}}.",
				),
				postDirectoryItem,
			),
			textParagraph(
				t(
					"detail.selfMedia.coverGeneration.prompt.metadata",
					"Title: {{title}}\nGenerate: {{coverTypes}}",
					{
						title: titleOf(post),
						coverTypes: coverTypeLabels(coverTypes),
					},
				),
			),
			textParagraph(
				t(
					"detail.selfMedia.coverGeneration.prompt.instruction",
					"Read post.json and the article HTML first. Generate only the requested missing covers with generate_image, keep their visual language consistent with the article, save them under the post assets folder, and update the matching heroCover or thumbnailCover path in post.json. Use 21:9 for heroCover and 1:1 for thumbnailCover. Preserve every existing cover that was not requested.",
				),
			),
		],
	}
}

export async function sendSelfMediaWechatCoverGeneration({
	selectedProject,
	selectedModel,
	post,
	postDirectoryItem,
	coverTypes,
}: {
	selectedProject: { id: string } | null | undefined
	selectedModel?: ModelItem | null
	post: SelfMediaPost
	postDirectoryItem: AttachmentItem
	coverTypes: SelfMediaWechatCoverType[]
}) {
	if (!selectedProject?.id) throw new Error("No project selected")
	if (coverTypes.length === 0) throw new Error("No missing cover image")

	const topicMode = SELF_MEDIA_TOPIC_PATTERN as unknown as TopicMode
	const content = buildSelfMediaWechatCoverGenerationContent({
		post,
		postDirectoryItem,
		coverTypes,
	})
	const topicName = t(
		"detail.selfMedia.coverGeneration.prompt.topicName",
		"[Generate covers] {{title}}",
		{ title: titleOf(post) },
	)

	pubsub.publish(PubSubEvents.Create_New_Topic, {
		topicMode,
		topicName,
		afterCreate: {
			content,
			send: true,
			topicMode,
			mentionItems: [buildFolderMentionItem(postDirectoryItem)],
			extra: {
				super_agent: {
					topic_pattern: SELF_MEDIA_TOPIC_PATTERN,
					chat_mode: "normal",
					enable_web_search: false,
					...(selectedModel ? { model: selectedModel } : {}),
					dynamic_params: {
						message_version: "v2",
					},
				},
			},
		},
	})
}
