import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { Input } from "@/components/shadcn-ui/input"
import { MagicSelect } from "@/components/base"
import { MagicSwitch } from "@/components/base/MagicSwitch"
import { ScheduledItem } from "@/components/business/AccountSetting/pages/ScheduledTasks/components/ScheduledItem"
import type { ScheduledTask } from "@/types/scheduledTask"
import ModelIcon from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelIcon"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { MagicPromptEditor } from "@/components/base/MagicPromptEditor"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { CARD_TEMPLATES } from "../hooks/useAICardConfig"
import type { CardTemplateType } from "../hooks/useAICardConfig"
import AICardNotificationFields from "./AICardNotificationFields"
import type { AICardNotificationConfig } from "../utils/aiCardNotification"

export interface AICardFormFieldsValues {
	taskName: string
	prompt: string
	template: CardTemplateType
	customTemplatePrompt?: string
	timeConfig?: ScheduledTask.TimeConfig | null
	enabled?: boolean
	model?: ModelItem | null
	imageModel?: ModelItem | null
	videoModel?: ModelItem | null
	notification?: AICardNotificationConfig
}

interface AICardFormFieldsProps {
	values: AICardFormFieldsValues
	onChange: (updates: Partial<AICardFormFieldsValues>) => void
	disabled?: boolean
	/** Model lists — when provided, the model selects section renders */
	modelList?: ModelItem[]
	imageModelList?: ModelItem[]
	videoModelList?: ModelItem[]
	/** Hide template selection (e.g. when a template file already exists) */
	hideTemplate?: boolean
	/** Hide the enabled toggle when a parent layout renders it elsewhere */
	hideEnabledToggle?: boolean
	/** Maximum height for the prompt editor before it scrolls internally */
	promptMaxHeight?: number
}

function AICardFormFields({
	values,
	onChange,
	disabled,
	modelList,
	imageModelList,
	videoModelList,
	hideTemplate = false,
	hideEnabledToggle = false,
	promptMaxHeight,
}: AICardFormFieldsProps) {
	const { t } = useTranslation("super")

	/** Parse the stored prompt JSON string back to JSONContent for the editor */
	const promptJSON = useMemo((): JSONContent | undefined => {
		if (!values.prompt) return undefined
		try {
			return JSON.parse(values.prompt) as JSONContent
		} catch {
			// Fallback: if the stored value is plain text (legacy), wrap it as a paragraph
			return {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: values.prompt }] }],
			}
		}
	}, [values.prompt])

	const handleTimeConfigChange = useCallback(
		(config: ScheduledTask.TimeConfig) => {
			onChange({ timeConfig: config })
		},
		[onChange],
	)

	const handleModelChange = useCallback(
		(modelId: string) => {
			const model = modelList?.find((m) => m.model_id === modelId) || null
			onChange({ model })
		},
		[modelList, onChange],
	)

	const handleImageModelChange = useCallback(
		(modelId: string) => {
			const model = imageModelList?.find((m) => m.model_id === modelId) || null
			onChange({ imageModel: model })
		},
		[imageModelList, onChange],
	)

	const handleVideoModelChange = useCallback(
		(modelId: string) => {
			const model = videoModelList?.find((m) => m.model_id === modelId) || null
			onChange({ videoModel: model })
		},
		[videoModelList, onChange],
	)

	const renderModelOption = useCallback(
		(models: ModelItem[]) => (option: { label: React.ReactNode; value: string | number }) => {
			const model = models.find((m) => m.model_id === String(option.value))
			if (!model) return option.label
			return (
				<span className="flex items-center gap-2">
					<ModelIcon model={model} size={16} className="shrink-0 rounded-sm" />
					<span className="truncate">{model.model_name}</span>
				</span>
			)
		},
		[],
	)

	const renderModelLabel = useCallback(
		(models: ModelItem[]) => (option: { label: React.ReactNode; value: string | number }) => {
			const model = models.find((m) => m.model_id === String(option.value))
			if (!model) return option.label
			return (
				<span className="flex min-w-0 items-center gap-2">
					<ModelIcon model={model} size={14} className="shrink-0 rounded-sm" />
					<span className="min-w-0 truncate">{model.model_name}</span>
				</span>
			)
		},
		[],
	)

	const hasModelOptions =
		Boolean(modelList?.length) ||
		Boolean(imageModelList?.length) ||
		Boolean(videoModelList?.length)

	return (
		<>
			{/* Card Name */}
			<div className="space-y-2">
				<label
					className="text-sm font-medium text-foreground"
					data-testid="ai-card-form-fields-label"
				>
					{t("detail.aiCard.form.cardName")} <span className="text-destructive">*</span>
				</label>
				<Input
					value={values.taskName}
					onChange={(e) => onChange({ taskName: e.target.value })}
					placeholder={t("detail.aiCard.form.cardNamePlaceholder")}
					disabled={disabled}
					className="h-10"
				/>
			</div>

			{/* Template */}
			{!hideTemplate && (
				<div className="space-y-2">
					<label
						className="text-sm font-medium text-foreground"
						data-testid="ai-card-form-fields-label-2"
					>
						{t("detail.aiCard.form.template")}
					</label>
					<MagicSelect
						value={values.template}
						onChange={(val: CardTemplateType) => onChange({ template: val })}
						className="w-full"
						disabled={disabled}
						options={CARD_TEMPLATES.map((opt) => ({
							label: t(opt.labelKey),
							value: opt.value,
						}))}
					/>
					{values.template === "custom" && (
						<textarea
							value={values.customTemplatePrompt || ""}
							onChange={(e) => onChange({ customTemplatePrompt: e.target.value })}
							placeholder={t("detail.aiCard.form.customTemplatePlaceholder")}
							disabled={disabled}
							rows={3}
							className={cn(
								"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
								"ring-offset-background placeholder:text-muted-foreground",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								"disabled:cursor-not-allowed disabled:opacity-50",
								"resize-y",
							)}
							data-testid="on-change"
						/>
					)}
					<p className="text-xs text-muted-foreground">
						{t("detail.aiCard.form.templateHint")}
					</p>
				</div>
			)}

			{/* Prompt */}
			<div className="space-y-2">
				<label
					className="text-sm font-medium text-foreground"
					data-testid="ai-card-form-fields-label-3"
				>
					{t("detail.aiCard.form.prompt")} <span className="text-destructive">*</span>
				</label>
				<MagicPromptEditor
					value={promptJSON}
					onChange={(json: JSONContent) => onChange({ prompt: JSON.stringify(json) })}
					placeholder={t("detail.aiCard.form.promptPlaceholder")}
					disabled={disabled}
					rows={4}
					maxHeight={promptMaxHeight}
					enableMention
					enableAIPolish
					enableVoice
				/>
				<p className="text-xs text-muted-foreground">
					{t("detail.aiCard.form.promptHint")}
				</p>
			</div>

			{/* Schedule */}
			<div className="space-y-2">
				<label
					className="text-sm font-medium text-foreground"
					data-testid="ai-card-form-fields-label-4"
				>
					{t("detail.aiCard.config.schedule")}
				</label>
				<ScheduledItem
					value={values.timeConfig || undefined}
					onChange={handleTimeConfigChange}
					disabled={disabled}
				/>
			</div>

			<AICardNotificationFields
				value={values.notification}
				onChange={(notification) => onChange({ notification })}
				disabled={disabled}
			/>

			{/* Model selections — 3 column grid */}
			{hasModelOptions && (
				<div className="space-y-3 rounded-lg border border-border px-4 py-3">
					<div className="text-sm font-medium text-foreground">
						{t("detail.aiCard.config.modelSection")}
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{/* Language model */}
						{modelList && modelList.length > 0 && (
							<div className="min-w-0 space-y-1.5">
								<label
									className="text-xs text-muted-foreground"
									data-testid="ai-card-form-fields-label-5"
								>
									{t("detail.aiCard.config.languageModel")}
								</label>
								<MagicSelect
									value={values.model?.model_id || undefined}
									onChange={handleModelChange}
									placeholder={t("detail.aiCard.config.defaultModel")}
									className="w-full"
									disabled={disabled}
									options={modelList.map((m) => ({
										label: m.model_name,
										value: m.model_id,
									}))}
									optionRender={renderModelOption(modelList)}
									labelRender={renderModelLabel(modelList)}
									popupClassName="max-h-[280px] overflow-y-auto"
								/>
							</div>
						)}

						{/* Image model */}
						{imageModelList && imageModelList.length > 0 && (
							<div className="min-w-0 space-y-1.5">
								<label
									className="text-xs text-muted-foreground"
									data-testid="ai-card-form-fields-label-6"
								>
									{t("detail.aiCard.config.imageModel")}
								</label>
								<MagicSelect
									value={values.imageModel?.model_id || undefined}
									onChange={handleImageModelChange}
									placeholder={t("detail.aiCard.config.defaultImageModel")}
									className="w-full"
									disabled={disabled}
									options={imageModelList.map((m) => ({
										label: m.model_name,
										value: m.model_id,
									}))}
									optionRender={renderModelOption(imageModelList)}
									labelRender={renderModelLabel(imageModelList)}
									popupClassName="max-h-[280px] overflow-y-auto"
								/>
							</div>
						)}

						{/* Video model */}
						{videoModelList && videoModelList.length > 0 && (
							<div className="min-w-0 space-y-1.5">
								<label
									className="text-xs text-muted-foreground"
									data-testid="ai-card-form-fields-label-7"
								>
									{t("detail.aiCard.config.videoModel")}
								</label>
								<MagicSelect
									value={values.videoModel?.model_id || undefined}
									onChange={handleVideoModelChange}
									placeholder={t("detail.aiCard.config.defaultVideoModel")}
									className="w-full"
									disabled={disabled}
									options={videoModelList.map((m) => ({
										label: m.model_name,
										value: m.model_id,
									}))}
									optionRender={renderModelOption(videoModelList)}
									labelRender={renderModelLabel(videoModelList)}
									popupClassName="max-h-[280px] overflow-y-auto"
								/>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Enabled toggle — outside collapsible section */}
			{!hideEnabledToggle && (
				<div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
					<div>
						<div className="text-sm font-medium text-foreground">
							{t("detail.aiCard.config.enableSchedule")}
						</div>
						<div className="text-xs text-muted-foreground">
							{t("detail.aiCard.config.enableScheduleHint")}
						</div>
					</div>
					<MagicSwitch
						checked={values.enabled ?? true}
						onChange={(checked) => onChange({ enabled: checked })}
						disabled={disabled}
					/>
				</div>
			)}
		</>
	)
}

export default AICardFormFields
