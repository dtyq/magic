import { SuperMagicApi } from "@/apis"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { buildPlainTextJSONContent } from "../../../../MessageEditor/utils"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import i18n from "i18next"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { ScheduledTask } from "@/types/scheduledTask"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { AICardNotificationConfig } from "../../AICardRootRender/utils/aiCardNotification"
import { compactAICardNotification } from "../../AICardRootRender/utils/aiCardNotification"
import { createAICardId, generateAICardDeepLink } from "../../AICardRootRender/utils/aiCardDeepLink"

export interface AICardCreateParams {
	/** User's analysis prompt (plain text, used for template text) */
	prompt: string
	/** User's prompt as JSONContent (preserves @mention nodes) */
	promptJSONContent?: JSONContent
	/** Card name (e.g. "抖音热点追踪") */
	cardName: string
	/** Template choice */
	template: "hotspot-tracker" | "daily-digest" | "analytics-panel" | "custom"
	/** Custom template requirements (when template is "custom") */
	customTemplatePrompt?: string
	/** Project ID */
	projectId: string
	/** Folder path of the self-media project (optional) */
	folderPath?: string
	/** Schedule time config (optional — if provided, included in prompt) */
	timeConfig?: ScheduledTask.TimeConfig | null
	/** Whether the scheduled task should be enabled */
	enabled?: boolean
	/** Selected language model */
	model?: ModelItem | null
	/** Selected image model */
	imageModel?: ModelItem | null
	/** Selected video model */
	videoModel?: ModelItem | null
	/** Notification targets to save into magic.project.js */
	notification?: AICardNotificationConfig
	/** Stable AI card id used by frontend deep links */
	cardId?: string
	/** Full frontend URL that opens the generated AI card */
	cardPathOrLink?: string
}

const SEND_MESSAGE_DELAY_MS = 300
const I18N_NS = "super"
const NOTIFICATION_CHANNEL_LABELS: Record<
	AICardNotificationConfig["channels"][number]["channel"],
	{ key: string; defaultValue: string }
> = {
	dingtalk: {
		key: "detail.aiCard.createMessage.notificationChannels.dingtalk",
		defaultValue: "DingTalk",
	},
	wecom: {
		key: "detail.aiCard.createMessage.notificationChannels.wecom",
		defaultValue: "WeCom",
	},
	lark: {
		key: "detail.aiCard.createMessage.notificationChannels.lark",
		defaultValue: "Lark",
	},
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

function sectionTitle(title: string): string {
	return t("detail.aiCard.createMessage.sectionTitle", "━━━ {{title}} ━━━", { title })
}

function formatNotificationTargetLines(notification: AICardNotificationConfig): string[] {
	return notification.channels.map(({ channel, targetDescription }) => {
		const channelLabel = NOTIFICATION_CHANNEL_LABELS[channel]
		return t(
			"detail.aiCard.createMessage.notificationTargetLine",
			"{{channel}}: {{targetDescription}}",
			{
				channel: t(channelLabel.key, channelLabel.defaultValue),
				targetDescription,
			},
		)
	})
}

/**
 * Format a TimeConfig into a human-readable schedule description.
 */
function formatScheduleDescription(timeConfig: ScheduledTask.TimeConfig): string {
	const { type, time, day } = timeConfig
	switch (type) {
		case "no_repeat":
			return t("detail.aiCard.createMessage.schedule.noRepeat", "once at {{time}}", {
				time,
			})
		case "daily_repeat":
			return t("detail.aiCard.createMessage.schedule.daily", "daily at {{time}}", { time })
		case "weekly_repeat":
			return t(
				"detail.aiCard.createMessage.schedule.weekly",
				"weekly on {{day}} at {{time}}",
				{
					day: day
						? t("detail.aiCard.createMessage.schedule.weeklyDay", "{{day}}", { day })
						: "",
					time,
				},
			)
		case "monthly_repeat":
			return t(
				"detail.aiCard.createMessage.schedule.monthly",
				"monthly on day {{day}} at {{time}}",
				{
					day: day || "",
					time,
				},
			)
		default:
			return t("detail.aiCard.createMessage.schedule.default", "at {{time}}", { time })
	}
}

/**
 * Build the prompt message that triggers the ai-card-generator skill.
 * Returns the prefix lines (everything before the user's prompt).
 */
function buildAICardCreatePrefixLines(params: AICardCreateParams): string[] {
	const {
		cardName,
		template,
		customTemplatePrompt,
		folderPath,
		timeConfig,
		enabled,
		cardId,
		cardPathOrLink,
	} = params

	const cardDir = [folderPath, cardName].filter(Boolean).join("/")

	let updateModeLine: string
	if (timeConfig) {
		const scheduleDesc = formatScheduleDescription(timeConfig)
		const enabledText = t(
			enabled !== false
				? "detail.aiCard.createMessage.schedule.enabled"
				: "detail.aiCard.createMessage.schedule.disabled",
			enabled !== false ? " (enabled)" : " (disabled)",
		)
		updateModeLine = t(
			"detail.aiCard.createMessage.update.scheduled",
			"Schedule: {{schedule}}{{enabledText}}",
			{
				schedule: scheduleDesc,
				enabledText,
			},
		)
	} else if (enabled === false) {
		updateModeLine = t(
			"detail.aiCard.createMessage.update.once",
			"Update mode: one-time generation",
		)
	} else {
		updateModeLine = t(
			"detail.aiCard.createMessage.update.defaultScheduled",
			"Update mode: default scheduled updates",
		)
	}

	const lines = [
		t("detail.aiCard.createMessage.title", 'Create an AI Card named "{{cardName}}".', {
			cardName,
		}),
		``,
		sectionTitle(t("detail.aiCard.createMessage.sections.cardData", "Card data")),
		...(cardId
			? [t("detail.aiCard.createMessage.cardId", "Card ID: {{cardId}}", { cardId })]
			: []),
		...(cardPathOrLink
			? [
					t("detail.aiCard.createMessage.cardLink", "Card link: {{cardLink}}", {
						cardLink: cardPathOrLink,
					}),
				]
			: []),
		``,
		sectionTitle(
			t("detail.aiCard.createMessage.sections.createRequirement", "Creation requirements"),
		),
		t("detail.aiCard.createMessage.location", "Location: {{cardDir}}/", { cardDir }),
		t("detail.aiCard.createMessage.template", "Template: {{template}}", { template }),
		...(template === "custom" && customTemplatePrompt
			? [
					t(
						"detail.aiCard.createMessage.customTemplate",
						"Custom template: {{customTemplate}}",
						{
							customTemplate: customTemplatePrompt,
						},
					),
				]
			: []),
		updateModeLine,
		``,
		sectionTitle(
			t("detail.aiCard.createMessage.sections.analysisInstruction", "Analysis instructions"),
		),
	]

	const notification = compactAICardNotification(params.notification)
	if (!notification) return lines

	return [
		...lines.slice(0, -2),
		sectionTitle(
			t("detail.aiCard.createMessage.sections.notificationTargets", "Notification targets"),
		),
		...formatNotificationTargetLines(notification),
		``,
		...lines.slice(-2),
	]
}

/**
 * Build the final JSONContent for the message, preserving @mention nodes
 * from the user's prompt while prepending instruction text.
 */
function buildAICardCreateJSONContent(params: AICardCreateParams): JSONContent {
	const prefixLines = buildAICardCreatePrefixLines(params)
	const prefixContent = buildPlainTextJSONContent(prefixLines.join("\n"))

	if (params.promptJSONContent?.content) {
		// Merge prefix paragraphs + user's original prompt paragraphs (with mentions)
		return {
			type: "doc",
			content: [...(prefixContent.content || []), ...params.promptJSONContent.content],
		}
	}

	// Fallback: append plain text prompt
	const promptParagraph = { type: "paragraph", content: [{ type: "text", text: params.prompt }] }
	return {
		type: "doc",
		content: [...(prefixContent.content || []), promptParagraph],
	}
}

/**
 * Create a new topic in ip-manager and send a message that triggers
 * the ai-card-generator skill to create all card files, optionally with a scheduled task.
 */
export async function createAICardViaTopic(
	params: AICardCreateParams,
): Promise<{ topicId: string } | null> {
	const { projectId, cardName, model, imageModel, videoModel } = params

	if (!projectId) {
		console.error("[aiCardCreate] No project selected")
		return null
	}

	const selectedProject = projectStore.selectedProject

	// Create a dedicated topic for this AI card creation
	const topicName = t("detail.aiCard.createMessage.topicName", "[AI Card] {{cardName}}", {
		cardName,
	})
	const newTopic = await SuperMagicApi.createTopic({
		project_id: projectId,
		topic_name: topicName,
	})

	if (!newTopic?.id) {
		console.error("[aiCardCreate] Failed to create topic")
		return null
	}

	const cardId = params.cardId || createAICardId()
	const cardPathOrLink =
		params.cardPathOrLink || generateAICardDeepLink(projectId, newTopic.id, cardId)
	const createParams: AICardCreateParams = {
		...params,
		cardId,
		cardPathOrLink,
	}

	// Pre-warm sandbox for faster execution
	SuperMagicApi.preWarmSandbox({ topic_id: newTopic.id })

	// Navigate to the new topic
	topicStore.setSelectedTopic(newTopic)
	routeManageService.navigateToState({
		projectId: selectedProject?.id || projectId,
		topicId: newTopic.id,
	})

	// Persist user-selected models to the new topic
	if (model || imageModel || videoModel) {
		superMagicTopicModelService.saveModel(
			newTopic.id,
			projectId,
			model || undefined,
			imageModel || undefined,
			videoModel || undefined,
		)
	}

	// Build extra with topic_pattern and user-selected models
	const superAgent: Record<string, unknown> = {
		topic_pattern: "ip-manager",
	}
	if (model) {
		superAgent.model = { model_id: model.model_id }
	}
	if (imageModel) {
		superAgent.image_model = { model_id: imageModel.model_id }
	}
	if (videoModel) {
		superAgent.video_model = { model_id: videoModel.model_id }
	}

	// Build and send message after a short delay (allow topic switch to settle)
	const jsonContent = buildAICardCreateJSONContent(createParams)
	const payload = {
		jsonContent,
		extra: {
			super_agent: superAgent,
		},
	}

	setTimeout(() => {
		pubsub.publish(PubSubEvents.Send_Message_by_Content, payload)
	}, SEND_MESSAGE_DELAY_MS)

	return { topicId: newTopic.id }
}
