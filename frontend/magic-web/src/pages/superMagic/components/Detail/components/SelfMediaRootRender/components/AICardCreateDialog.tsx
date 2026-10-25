import { useCallback, useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { superMagicTopicModelCacheService } from "@/services/superMagic/topicModel"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { MagicSwitch } from "@/components/base/MagicSwitch"
import AICardFormFields from "../../AICardRootRender/components/AICardFormFields"
import type { AICardFormFieldsValues } from "../../AICardRootRender/components/AICardFormFields"
import { getPromptPlainText } from "../../AICardRootRender/hooks/aiCardScheduleMessage"
import { compactAICardNotification } from "../../AICardRootRender/utils/aiCardNotification"
import { createAICardViaTopic } from "../services/aiCardCreate"
import { selfMediaOverlayStyles } from "./selfMediaOverlayStyles"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"

const AI_CARD_TOPIC_PATTERN = "ip-manager"

const DEFAULT_AI_CARD_FORM_VALUES: AICardFormFieldsValues = {
	taskName: "",
	prompt: "",
	template: "hotspot-tracker",
	enabled: true,
	notification: { channels: [] },
}

function parsePromptJSONContent(prompt: string): JSONContent | undefined {
	try {
		const parsed = JSON.parse(prompt) as JSONContent
		if (parsed?.type === "doc" && Array.isArray(parsed.content)) return parsed
	} catch {
		// Plain text prompts are still valid; only rich editor values need parsing.
	}
	return undefined
}

export type AICardCreateInitialValues = Partial<AICardFormFieldsValues>

interface AICardCreateDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	projectId: string
	folderPath?: string
	initialValues?: AICardCreateInitialValues
}

function AICardCreateDialog({
	open,
	onOpenChange,
	projectId,
	folderPath,
	initialValues,
}: AICardCreateDialogProps) {
	const { t } = useTranslation("super")
	const [formValues, setFormValues] = useState<AICardFormFieldsValues>(
		DEFAULT_AI_CARD_FORM_VALUES,
	)
	const [submitting, setSubmitting] = useState(false)
	const [modelList, setModelList] = useState<ModelItem[]>([])
	const [imageModelList, setImageModelList] = useState<ModelItem[]>([])
	const [videoModelList, setVideoModelList] = useState<ModelItem[]>([])

	useEffect(() => {
		if (open) {
			setFormValues({ ...DEFAULT_AI_CARD_FORM_VALUES, ...initialValues })

			const langModels = superMagicModeService.getModelListByMode(AI_CARD_TOPIC_PATTERN)
			const imgModels = superMagicModeService.getImageModelListByMode(AI_CARD_TOPIC_PATTERN)
			const vidModels = superMagicModeService.getVideoModelListByMode(AI_CARD_TOPIC_PATTERN)
			setModelList(langModels)
			setImageModelList(imgModels)
			setVideoModelList(vidModels)

			// Load project-level persisted model selections as defaults
			superMagicTopicModelCacheService.getProjectModel(projectId).then((cached) => {
				if (!cached) return
				const defaultModel = cached.languageModelId
					? langModels.find((m) => m.model_id === cached.languageModelId) || null
					: null
				const defaultImageModel = cached.imageModelId
					? imgModels.find((m) => m.model_id === cached.imageModelId) || null
					: null
				const defaultVideoModel = cached.videoModelId
					? vidModels.find((m) => m.model_id === cached.videoModelId) || null
					: null
				setFormValues((prev) => ({
					...prev,
					model: prev.model || defaultModel,
					imageModel: prev.imageModel || defaultImageModel,
					videoModel: prev.videoModel || defaultVideoModel,
				}))
			})
		}
	}, [open, projectId, initialValues])

	const promptText = getPromptPlainText(formValues.prompt)
	const isValid = Boolean(formValues.taskName.trim() && promptText)

	const handleChange = useCallback((updates: Partial<AICardFormFieldsValues>) => {
		setFormValues((prev) => ({ ...prev, ...updates }))
	}, [])

	const handleSubmit = useCallback(async () => {
		if (!isValid || submitting) return
		setSubmitting(true)

		try {
			await createAICardViaTopic({
				prompt: promptText,
				promptJSONContent: parsePromptJSONContent(formValues.prompt),
				cardName: formValues.taskName.trim(),
				template: formValues.template,
				customTemplatePrompt: formValues.customTemplatePrompt?.trim(),
				projectId,
				folderPath,
				timeConfig: formValues.timeConfig,
				enabled: formValues.enabled,
				model: formValues.model,
				imageModel: formValues.imageModel,
				videoModel: formValues.videoModel,
				notification: compactAICardNotification(formValues.notification),
			})
			// Close dialog after successful submission
			onOpenChange(false)
			// Reset form
			setFormValues(DEFAULT_AI_CARD_FORM_VALUES)
		} finally {
			setSubmitting(false)
		}
	}, [isValid, submitting, formValues, promptText, projectId, folderPath, onOpenChange])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (submitting) return
			onOpenChange(nextOpen)
		},
		[submitting, onOpenChange],
	)

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className={`grid max-h-[88vh] !max-w-[820px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 ${selfMediaOverlayStyles.dialogSurface}`}
				data-testid="ai-card-create-dialog-content"
			>
				<DialogHeader className={selfMediaOverlayStyles.dialogHeader}>
					<DialogTitle
						className={`flex items-center gap-2 ${selfMediaOverlayStyles.dialogTitle}`}
					>
						<Sparkles size={18} className="text-[#18181b]" />
						{t("detail.aiCard.createDialog.title")}
					</DialogTitle>
					<DialogDescription className={selfMediaOverlayStyles.dialogDescription}>
						{t("detail.aiCard.createDialog.description")}
					</DialogDescription>
				</DialogHeader>

				<div
					className={`${selfMediaOverlayStyles.dialogBody} space-y-5`}
					data-testid="ai-card-create-dialog-body"
				>
					<AICardFormFields
						values={formValues}
						onChange={handleChange}
						disabled={submitting}
						modelList={modelList}
						imageModelList={imageModelList}
						videoModelList={videoModelList}
						hideEnabledToggle
						promptMaxHeight={260}
					/>
				</div>

				<DialogFooter
					className={`flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${selfMediaOverlayStyles.dialogFooter}`}
					data-testid="ai-card-create-dialog-footer"
				>
					<div className="flex items-center gap-3">
						<MagicSwitch
							checked={formValues.enabled ?? true}
							onChange={(checked) => handleChange({ enabled: checked })}
							disabled={submitting}
						/>
						<div className="min-w-0">
							<div className="text-sm font-medium text-foreground">
								{t("detail.aiCard.config.enableSchedule")}
							</div>
							<div className="text-xs text-muted-foreground">
								{t("detail.aiCard.config.enableScheduleHint")}
							</div>
						</div>
					</div>
					<div className="flex justify-end gap-3">
						<Button
							variant="outline"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={() => onOpenChange(false)}
							disabled={submitting}
						>
							{t("detail.aiCard.createDialog.cancel")}
						</Button>
						<Button
							className={selfMediaOverlayStyles.primaryButton}
							onClick={handleSubmit}
							disabled={!isValid || submitting}
						>
							{submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
							{submitting
								? t("detail.aiCard.createDialog.creating")
								: t("detail.aiCard.createDialog.confirm")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default AICardCreateDialog

/**
 * Hook：提供函数式调用打开 AI 卡片创建弹窗的能力
 * 返回 { open, dialogElement }，将 dialogElement 渲染到组件树中即可
 */
export interface UseAICardCreateDialogOptions {
	projectId?: string
}

export function useAICardCreateDialog({ projectId = "" }: UseAICardCreateDialogOptions) {
	const [visible, setVisible] = useState(false)
	const [folderPath, setFolderPath] = useState<string | undefined>(undefined)

	const open = useCallback((path?: string) => {
		setFolderPath(path)
		setVisible(true)
	}, [])

	const dialogElement = (
		<AICardCreateDialog
			open={visible}
			onOpenChange={setVisible}
			projectId={projectId}
			folderPath={folderPath}
		/>
	)

	return { open, dialogElement }
}
