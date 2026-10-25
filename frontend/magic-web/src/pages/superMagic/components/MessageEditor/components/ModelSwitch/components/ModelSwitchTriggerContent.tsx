import { useTranslation } from "react-i18next"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/utils/cn"
import type { ModelItem, ModelTabType } from "../types"
import ModelIcon from "./ModelIcon"

interface ModelSwitchTriggerContentProps {
	showLabel: boolean
	selectedLanguageModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	selectedVideoModel?: ModelItem | null
	isLoading: boolean
	iconSize: number
	triggerTab?: ModelTabType
	showSelectedModelName?: boolean
}

export function ModelSwitchTriggerContent({
	showLabel,
	selectedLanguageModel,
	selectedImageModel,
	selectedVideoModel,
	isLoading,
	iconSize,
	triggerTab,
	showSelectedModelName = false,
}: ModelSwitchTriggerContentProps) {
	const { t } = useTranslation("super")
	const filterSelectedModel = (model: ModelItem | null | undefined): model is ModelItem =>
		Boolean(model)
	const visibleModels =
		triggerTab === "image"
			? [selectedImageModel].filter(filterSelectedModel)
			: triggerTab === "video"
				? [selectedVideoModel].filter(filterSelectedModel)
				: triggerTab === "language"
					? [selectedLanguageModel].filter(filterSelectedModel)
					: [selectedLanguageModel, selectedImageModel, selectedVideoModel].filter(
							filterSelectedModel,
						)
	const hasSelectedModel = visibleModels.length > 0
	const labelText =
		triggerTab === "image"
			? t("messageEditor.modelSwitch.imageModel")
			: triggerTab === "video"
				? t("messageEditor.modelSwitch.videoModel")
				: triggerTab === "language"
					? t("messageEditor.modelSwitch.languageModel")
					: t("messageEditor.modelSwitch.model")

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-xs font-normal leading-4 text-secondary-foreground",
				showSelectedModelName && hasSelectedModel
					? "min-w-0 flex-1 overflow-hidden"
					: hasSelectedModel
						? "shrink-0"
						: "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
			)}
		>
			{showLabel && labelText}
			{hasSelectedModel ? (
				<span
					className={cn(
						"inline-flex items-center gap-1",
						showSelectedModelName ? "min-w-0 flex-1" : "flex-shrink-0",
					)}
				>
					{visibleModels.map((model) => (
						<span
							key={model.id}
							className="inline-flex min-w-0 items-center gap-1.5"
							title={model.model_name || model.model_id}
						>
							<ModelIcon model={model} size={iconSize} className="flex-shrink-0" />
							{showSelectedModelName ? (
								<span className="truncate font-medium text-[#18181b]">
									{model.model_name || model.model_id}
								</span>
							) : null}
						</span>
					))}
				</span>
			) : (
				<span className="truncate text-muted-foreground">
					{t("messageEditor.modelSwitch.selectModel")}
				</span>
			)}
			{!hasSelectedModel && isLoading && (
				<Spinner className="animate-spin text-black/10" size={iconSize} />
			)}
		</span>
	)
}
