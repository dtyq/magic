import FlexBox from "@/components/base/FlexBox"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"
import type React from "react"
import type { ModelItem, ModelListGroup, MessageEditorSize } from "../types"
import { isModelDisabled } from "../utils"
import ModelName from "./ModelName"
import ModelTags from "./ModelTags"
import ProviderName from "./ProviderName"

export interface RenderableModelGroup extends ModelListGroup {
	displayModels: ModelItem[]
}

interface ModelGroupSectionProps {
	item: RenderableModelGroup
	selectedModel: ModelItem | null
	size: MessageEditorSize
	onModelClick: (model: ModelItem) => void
	selectedItemRef: React.RefObject<HTMLDivElement>
	getModelDescription: (model: ModelItem) => string | undefined
}

export function ModelGroupSection({
	item,
	selectedModel,
	size,
	onModelClick,
	selectedItemRef,
	getModelDescription,
}: ModelGroupSectionProps) {
	return (
		<FlexBox gap={4} vertical className="last:border-b-0 last:pb-0">
			<ProviderName item={item.group} />
			<div className="flex flex-col gap-1">
				{item.displayModels.map((model) => {
					const isSelected = selectedModel?.model_id === model.model_id
					const isDisabled = isModelDisabled(model)

					return (
						<div
							key={model.model_id}
							ref={isSelected ? selectedItemRef : null}
							className={cn(
								"flex items-center rounded px-3 py-2",
								"relative cursor-pointer gap-2.5 transition-all duration-200",
								"group",
								"[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
							)}
							onClick={() => onModelClick(model)}
							data-testid="model-switch-item"
							data-model-id={model.model_id}
							data-model-name={model.model_name}
							data-selected={isSelected}
						>
							<FlexBox vertical gap={1} flex={1} className="min-w-0">
								<FlexBox gap={2} align="center">
									<ModelName
										model={model}
										isSelected={false}
										className={cn(
											"w-fit max-w-full",
											size === "small" && "max-w-20",
											size === "mobile" && "max-w-[60px]",
											isDisabled && "opacity-50",
										)}
									/>
									<ModelTags model={model} />
								</FlexBox>
								<div
									className={cn(
										"text-xs font-normal leading-4 text-muted-foreground",
										"empty:hidden",
										isDisabled && "opacity-50",
									)}
								>
									{getModelDescription(model)}
								</div>
							</FlexBox>
							<Checkbox
								checked={isSelected}
								onCheckedChange={() => onModelClick(model)}
								onClick={(e) => e.stopPropagation()}
								className={cn(
									"flex-shrink-0",
									"invisible opacity-0 transition-opacity",
									"[@media(hover:hover)_and_(pointer:fine)]:group-hover:visible",
									"[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
									isSelected && "visible opacity-100",
								)}
							/>
						</div>
					)
				})}
			</div>
		</FlexBox>
	)
}
