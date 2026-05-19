import { useTranslation } from "react-i18next"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/lib/utils"
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
}

export function ModelSwitchTriggerContent({
	showLabel,
	selectedLanguageModel,
	selectedImageModel,
	selectedVideoModel,
	isLoading,
	iconSize,
	triggerTab,
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
				hasSelectedModel
					? "shrink-0"
					: "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
			)}
		>
			{showLabel && labelText}
			{hasSelectedModel ? (
				<span className="inline-flex flex-shrink-0 items-center gap-1">
					{visibleModels.map((model) => (
						<ModelIcon
							key={model.id}
							model={model}
							size={iconSize}
							className="flex-shrink-0"
						/>
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
