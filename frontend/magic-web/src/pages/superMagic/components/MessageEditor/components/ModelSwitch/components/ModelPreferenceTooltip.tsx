import ModelIcon from "./ModelIcon"
import type { ModelItem } from "../types"
import { useTranslation } from "react-i18next"

interface ModelPreferenceTooltipProps {
	selectedLanguageModel: ModelItem | null
	selectedImageModel: ModelItem | null
	selectedVideoModel: ModelItem | null
}

export function ModelPreferenceTooltip({
	selectedLanguageModel,
	selectedImageModel,
	selectedVideoModel,
}: ModelPreferenceTooltipProps) {
	const { t } = useTranslation("super")
	const placeholder = t("messageEditor.pleaseSelectModel")
	const selectedModelSections = [
		{
			key: "language",
			title: t("messageEditor.modelSwitch.tooltipLanguageModel"),
			model: selectedLanguageModel,
		},
		{
			key: "image",
			title: t("messageEditor.modelSwitch.tooltipImageModel"),
			model: selectedImageModel,
		},
		{
			key: "video",
			title: t("messageEditor.modelSwitch.tooltipVideoModel"),
			model: selectedVideoModel,
		},
	].filter((item): item is { key: string; title: string; model: ModelItem } => !!item.model)
	const hasSelectedModel = selectedModelSections.length > 0

	if (!hasSelectedModel) {
		return (
			<div className="flex min-w-[108px] flex-col gap-1 rounded-md bg-primary px-3 py-1.5">
				<div className="text-xs font-normal leading-4 text-primary-foreground">
					{placeholder}
				</div>
			</div>
		)
	}

	return (
		<div className="flex min-w-[108px] flex-col gap-1.5 rounded-md bg-primary px-3 py-1.5">
			{selectedModelSections.map(({ key, title, model }) => (
				<div key={key} className="flex flex-col gap-1">
					<div className="text-xs font-normal leading-4 text-primary-foreground/70">
						{title}
					</div>
					<div className="flex min-w-0 items-center gap-1 leading-none">
						<ModelIcon
							model={model}
							className="size-4 flex-shrink-0 rounded"
							size={16}
							defaultColor="#ffffff"
						/>
						<span className="min-w-0 flex-1 overflow-hidden overflow-y-visible text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-primary-foreground">
							{model.model_name}
						</span>
					</div>
				</div>
			))}
		</div>
	)
}
