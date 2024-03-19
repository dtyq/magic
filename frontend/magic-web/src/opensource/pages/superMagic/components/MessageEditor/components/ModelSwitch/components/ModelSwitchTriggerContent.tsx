import { useTranslation } from "react-i18next"
import { Spinner } from "@/opensource/components/shadcn-ui/spinner"
import { cn } from "@/opensource/lib/utils"
import type { ModelItem } from "../types"
import ModelIcon from "./ModelIcon"

interface ModelSwitchTriggerContentProps {
	showLabel: boolean
	selectedLanguageModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	isLoading: boolean
	iconSize: number
}

export function ModelSwitchTriggerContent({
	showLabel,
	selectedLanguageModel,
	selectedImageModel,
	isLoading,
	iconSize,
}: ModelSwitchTriggerContentProps) {
	const { t } = useTranslation("super")
	const hasSelectedModel = !!(selectedLanguageModel || selectedImageModel)

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-xs font-normal leading-4",
				"overflow-hidden text-ellipsis whitespace-nowrap text-secondary-foreground",
				"min-w-0 flex-1",
			)}
		>
			{showLabel && t("messageEditor.modelSwitch.model")}
			{hasSelectedModel ? (
				<span className="inline-flex flex-shrink-0 items-center gap-1">
					{selectedLanguageModel && (
						<ModelIcon
							model={selectedLanguageModel}
							size={iconSize}
							className="flex-shrink-0"
						/>
					)}
					{selectedImageModel && (
						<ModelIcon
							model={selectedImageModel}
							size={iconSize}
							className="flex-shrink-0"
						/>
					)}
				</span>
			) : (
				<span className="truncate text-muted-foreground">
					{t("messageEditor.modelSwitch.selectModel")}
				</span>
			)}
			{isLoading && <Spinner className="animate-spin text-black/10" size={iconSize} />}
		</span>
	)
}
