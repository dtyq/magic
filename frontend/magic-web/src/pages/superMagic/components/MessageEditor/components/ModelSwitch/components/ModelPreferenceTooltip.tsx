import ModelIcon from "./ModelIcon"
import { ModelItem } from "../types"
import { useTranslation } from "react-i18next"

interface ModelPreferenceTooltipProps {
	selectedLanguageModel: ModelItem | null
	selectedImageModel: ModelItem | null
}

export function ModelPreferenceTooltip({
	selectedLanguageModel,
	selectedImageModel,
}: ModelPreferenceTooltipProps) {
	const { t } = useTranslation("super")
	const placeholder = t("messageEditor.pleaseSelectModel")
	const hasSelectedModel = !!(selectedLanguageModel || selectedImageModel)

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
			<div className="flex flex-col gap-1">
				<div className="text-xs font-normal leading-4 text-primary-foreground/70">
					{t("messageEditor.modelSwitch.tooltipLanguageModel")}
				</div>
				<div className="flex min-w-0 items-center gap-1 leading-none">
					{selectedLanguageModel ? (
						<>
							<ModelIcon
								model={selectedLanguageModel}
								className="size-4 flex-shrink-0 rounded"
								size={16}
								defaultColor="#ffffff"
							/>
							<span className="min-w-0 flex-1 overflow-hidden overflow-y-visible text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-primary-foreground">
								{selectedLanguageModel.model_name}
							</span>
						</>
					) : (
						<span className="text-xs font-normal leading-4 text-primary-foreground/70">
							{placeholder}
						</span>
					)}
				</div>
			</div>
			<div className="flex flex-col gap-1">
				<div className="text-xs font-normal leading-4 text-primary-foreground/70">
					{t("messageEditor.modelSwitch.tooltipImageModel")}
				</div>
				<div className="flex min-w-0 items-center gap-1 leading-none">
					{selectedImageModel ? (
						<>
							<ModelIcon
								model={selectedImageModel}
								className="size-4 flex-shrink-0 rounded"
								size={16}
								defaultColor="#ffffff"
							/>
							<span className="min-w-0 flex-1 overflow-hidden overflow-y-visible text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-primary-foreground">
								{selectedImageModel.model_name}
							</span>
						</>
					) : (
						<span className="text-xs font-normal leading-4 text-primary-foreground/70">
							{placeholder}
						</span>
					)}
				</div>
			</div>
		</div>
	)
}
