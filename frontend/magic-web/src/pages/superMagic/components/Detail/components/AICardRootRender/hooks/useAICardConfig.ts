import { useState, useCallback, useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { ScheduledTaskApi, SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { ScheduledTask } from "@/types/scheduledTask"
import { workspaceStore, projectStore } from "@/pages/superMagic/stores/core"
import { createAICardViaTopic } from "../../SelfMediaRootRender/services/aiCardCreate"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { superMagicTopicModelCacheService } from "@/services/superMagic/topicModel"
import topicModelStore from "@/stores/superMagic/topicModelStore"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { AICardStore } from "../stores/AICardStore"
import { buildScheduleMessageJSONContent, getPromptPlainText } from "./aiCardScheduleMessage"
import {
	compactAICardNotification,
	EMPTY_AI_CARD_NOTIFICATION,
	normalizeAICardNotification,
	type AICardNotificationConfig,
} from "../utils/aiCardNotification"

const AI_CARD_TOPIC_PATTERN = "ip-manager"

/** Card templates available from the ai-card-generator skill */
export const CARD_TEMPLATES = [
	{ value: "hotspot-tracker", labelKey: "detail.aiCard.form.templateOptions.hotspotTracker" },
	{ value: "daily-digest", labelKey: "detail.aiCard.form.templateOptions.dailyDigest" },
	{ value: "analytics-panel", labelKey: "detail.aiCard.form.templateOptions.analyticsPanel" },
	{ value: "custom", labelKey: "detail.aiCard.form.templateOptions.custom" },
] as const

export type CardTemplateType = (typeof CARD_TEMPLATES)[number]["value"]

export interface AICardConfigFormValues {
	taskName: string
	prompt: string
	timeConfig: ScheduledTask.TimeConfig | null
	enabled: boolean
	deadline?: string
	model: ModelItem | null
	imageModel: ModelItem | null
	videoModel: ModelItem | null
	template: CardTemplateType
	customTemplatePrompt?: string
	notification: AICardNotificationConfig
}

const DEFAULT_FORM_VALUES: AICardConfigFormValues = {
	taskName: "",
	prompt: "",
	timeConfig: null,
	enabled: true,
	model: null,
	imageModel: null,
	videoModel: null,
	template: "hotspot-tracker",
	customTemplatePrompt: "",
	notification: EMPTY_AI_CARD_NOTIFICATION,
}

export function useAICardConfig(store: AICardStore) {
	const [formValues, setFormValues] = useState<AICardConfigFormValues>(DEFAULT_FORM_VALUES)
	const [saving, setSaving] = useState(false)
	const [savingDraft, setSavingDraft] = useState(false)
	const [loadingDetail, setLoadingDetail] = useState(true)
	const [modelList, setModelList] = useState<ModelItem[]>([])
	const [imageModelList, setImageModelList] = useState<ModelItem[]>([])
	const [videoModelList, setVideoModelList] = useState<ModelItem[]>([])
	// Track whether user has touched the form to avoid async overwrites
	const dirtyRef = useRef(false)

	// Load available models from ip-manager agent's model list
	useEffect(() => {
		const langModels = superMagicModeService.getModelListByMode(AI_CARD_TOPIC_PATTERN)
		const imgModels = superMagicModeService.getImageModelListByMode(AI_CARD_TOPIC_PATTERN)
		const vidModels = superMagicModeService.getVideoModelListByMode(AI_CARD_TOPIC_PATTERN)
		setModelList(langModels)
		setImageModelList(imgModels)
		setVideoModelList(vidModels)

		// Load project-level persisted model selections as initial defaults
		const selectedProject = projectStore.selectedProject
		if (selectedProject?.id) {
			superMagicTopicModelCacheService.getProjectModel(selectedProject.id).then((cached) => {
				if (!cached || dirtyRef.current) return
				setFormValues((prev) => {
					// Only fill in if not already set (e.g. from loadConfig)
					if (prev.model || prev.imageModel || prev.videoModel) return prev
					return {
						...prev,
						model: cached.languageModelId
							? langModels.find((m) => m.model_id === cached.languageModelId) || null
							: null,
						imageModel: cached.imageModelId
							? imgModels.find((m) => m.model_id === cached.imageModelId) || null
							: null,
						videoModel: cached.videoModelId
							? vidModels.find((m) => m.model_id === cached.videoModelId) || null
							: null,
					}
				})
			})
		}
	}, [])

	const loadConfig = useCallback(async () => {
		const config = store.projectConfig
		if (!config) {
			setLoadingDetail(false)
			return
		}

		const values: AICardConfigFormValues = {
			taskName: config.name || "",
			prompt: config.prompt || "",
			timeConfig: config.time_config || null,
			enabled: config.enabled === 1,
			model: topicModelStore.selectedLanguageModel || null,
			imageModel: topicModelStore.selectedImageModel || null,
			videoModel: topicModelStore.selectedVideoModel || null,
			template: (config.template as CardTemplateType) || "hotspot-tracker",
			customTemplatePrompt: config.custom_template_prompt || "",
			notification: normalizeAICardNotification(config.notification),
		}

		// Restore models from config if saved
		if (config.model?.model_id) {
			const found = modelList.find((m) => m.model_id === config.model!.model_id)
			if (found) values.model = found
			else
				values.model = {
					model_id: config.model.model_id,
					model_name: config.model.model_name || config.model.model_id,
				} as ModelItem
		}
		if (config.image_model?.model_id) {
			const found = imageModelList.find((m) => m.model_id === config.image_model!.model_id)
			if (found) values.imageModel = found
			else
				values.imageModel = {
					model_id: config.image_model.model_id,
					model_name: config.image_model.model_name || config.image_model.model_id,
				} as ModelItem
		}
		if (config.video_model?.model_id) {
			const found = videoModelList.find((m) => m.model_id === config.video_model!.model_id)
			if (found) values.videoModel = found
			else
				values.videoModel = {
					model_id: config.video_model.model_id,
					model_name: config.video_model.model_name || config.video_model.model_id,
				} as ModelItem
		}

		// Load full task detail from API if schedule_id exists
		if (config.schedule_id) {
			try {
				const detail = await ScheduledTaskApi.getScheduledTaskDetails(config.schedule_id)
				if (detail) {
					values.timeConfig = detail.time_config
					values.enabled = detail.enabled === 1
					values.taskName = detail.task_name || values.taskName
					values.deadline = detail.deadline
					// Restore model selections from saved task
					const superAgent = detail.message_content?.extra?.super_agent
					if (superAgent?.model) {
						values.model = superAgent.model as ModelItem
					}
					if ((superAgent as any)?.image_model) {
						values.imageModel = (superAgent as any).image_model as ModelItem
					}
					if ((superAgent as any)?.video_model) {
						values.videoModel = (superAgent as any).video_model as ModelItem
					}
				}
			} catch {
				// If task was deleted, ignore
			}
		}

		setFormValues(values)
		setLoadingDetail(false)
	}, [store.projectConfig, modelList, imageModelList, videoModelList])

	const hasScheduleId = !!store.projectConfig?.schedule_id

	const buildProjectConfig = useCallback(
		(values: AICardConfigFormValues) => {
			const notification = compactAICardNotification(values.notification)
			return {
				type: "ai-card",
				name: values.taskName.trim(),
				prompt: values.prompt.trim(),
				template: values.template,
				...(values.customTemplatePrompt
					? { custom_template_prompt: values.customTemplatePrompt.trim() }
					: {}),
				enabled: values.enabled ? 1 : 0,
				...(values.timeConfig ? { time_config: values.timeConfig } : {}),
				...(notification ? { notification } : {}),
				...(values.model
					? {
							model: {
								model_id: values.model.model_id,
								model_name: values.model.model_name,
							},
						}
					: {}),
				...(values.imageModel
					? {
							image_model: {
								model_id: values.imageModel.model_id,
								model_name: values.imageModel.model_name,
							},
						}
					: {}),
				...(values.videoModel
					? {
							video_model: {
								model_id: values.videoModel.model_id,
								model_name: values.videoModel.model_name,
							},
						}
					: {}),
				// Preserve runtime fields owned by generated card updates.
				...(store.projectConfig?.card_id ? { card_id: store.projectConfig.card_id } : {}),
				...(store.projectConfig?.card_path_or_link
					? { card_path_or_link: store.projectConfig.card_path_or_link }
					: {}),
				...(store.projectConfig?.schedule_id
					? { schedule_id: store.projectConfig.schedule_id }
					: {}),
				...(store.projectConfig?.last_generated
					? { last_generated: store.projectConfig.last_generated }
					: {}),
				...(store.projectConfig?.generation_count
					? { generation_count: store.projectConfig.generation_count }
					: {}),
				cards: store.projectConfig?.cards || [{ file: "latest.html", label: "latest" }],
			}
		},
		[store.projectConfig],
	)

	const saveProjectConfig = useMemoizedFn(async (values: AICardConfigFormValues) => {
		const configFileId = store.configFileId
		if (!configFileId) return

		const config = buildProjectConfig(values)
		const content = `window.magicProjectConfig = ${JSON.stringify(config, null, 2)}`
		await SuperMagicApi.saveFileContent([
			{ file_id: configFileId, content, enable_shadow: true },
		])
	})

	const saveConfig = useMemoizedFn(async (values: AICardConfigFormValues) => {
		if (!values.timeConfig) return

		const selectedWorkspace = workspaceStore.selectedWorkspace
		const selectedProject = projectStore.selectedProject

		if (!selectedProject?.id) {
			magicToast.error("请先选择一个有效的项目")
			return
		}

		setSaving(true)

		try {
			// Build rich_text message content preserving @mentions
			const messageJSONContent = buildScheduleMessageJSONContent(
				values.prompt,
				values.taskName,
				values.template,
				values.customTemplatePrompt,
			)

			const taskData: ScheduledTask.UpdateTask = {
				message_content: {
					content: JSON.stringify(messageJSONContent),
					extra: {
						super_agent: {
							topic_pattern: AI_CARD_TOPIC_PATTERN,
							chat_mode: "normal",
							model: values.model
								? ({ model_id: values.model.model_id } as any)
								: null,
							...(values.imageModel
								? {
										image_model: {
											model_id: values.imageModel.model_id,
										} as any,
									}
								: {}),
							...(values.videoModel
								? {
										video_model: {
											model_id: values.videoModel.model_id,
										} as any,
									}
								: {}),
						},
					},
				},
				message_type: "rich_text",
				enabled: values.enabled ? 1 : 0,
				task_name: values.taskName,
				time_config: values.timeConfig,
				topic_id: "",
				workspace_id: selectedWorkspace?.id || "",
				project_id: selectedProject?.id || "",
				deadline: values.deadline,
			}

			const scheduleId = store.projectConfig?.schedule_id

			if (scheduleId) {
				await ScheduledTaskApi.updateScheduledTask(scheduleId, {
					...taskData,
					id: scheduleId,
				})
			} else {
				await ScheduledTaskApi.createScheduledTask(taskData)
			}

			await saveProjectConfig(values)
			// Switch back to dashboard after save
			store.setViewMode("dashboard")
		} finally {
			setSaving(false)
		}
	})

	/** Create card via topic (used when no schedule_id exists) */
	const createCard = useMemoizedFn(async (values: AICardConfigFormValues) => {
		setSaving(true)
		try {
			const selectedProject = projectStore.selectedProject
			// Parse JSONContent to preserve @mention nodes
			let promptJSONContent: JSONContent | undefined
			try {
				promptJSONContent = JSON.parse(values.prompt) as JSONContent
			} catch {
				// fallback: plain text
			}
			await createAICardViaTopic({
				prompt: getPromptPlainText(values.prompt),
				promptJSONContent,
				cardName: values.taskName.trim(),
				template: values.template,
				customTemplatePrompt: values.customTemplatePrompt?.trim(),
				projectId: selectedProject?.id || "",
				timeConfig: values.timeConfig,
				enabled: values.enabled,
				model: values.model,
				imageModel: values.imageModel,
				videoModel: values.videoModel,
				notification: compactAICardNotification(values.notification),
			})
		} finally {
			setSaving(false)
		}
	})

	const updateFormValues = useMemoizedFn((updates: Partial<AICardConfigFormValues>) => {
		dirtyRef.current = true
		setFormValues((prev) => ({ ...prev, ...updates }))
	})

	/** Save form values to magic.project.js without triggering card generation */
	const saveDraft = useMemoizedFn(async (values: AICardConfigFormValues) => {
		setSavingDraft(true)
		try {
			await saveProjectConfig(values)
		} finally {
			setSavingDraft(false)
		}
	})

	return {
		formValues,
		updateFormValues,
		loadConfig,
		saveConfig,
		createCard,
		saveDraft,
		saving,
		savingDraft,
		loadingDetail,
		hasScheduleId,
		modelList,
		imageModelList,
		videoModelList,
	}
}
