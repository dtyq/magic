import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { cn } from "@/opensource/lib/utils"
import { userStore } from "@/opensource/models/user"
import { SearchX, Sparkles } from "lucide-react"
import { MyModelsList } from "./MyModelsList"
import type { ModelItem, ModelListGroup, MessageEditorSize } from "../types"
import type React from "react"
import { useTranslation } from "react-i18next"
import { isModelDisabled } from "../utils"
import { ModelEmptyState } from "./ModelEmptyState"
import { ModelGroupSection, type RenderableModelGroup } from "./ModelGroupSection"

interface ModelListContentProps {
	modelList: ModelListGroup[]
	selectedModel: ModelItem | null
	searchKeyword: string
	size: MessageEditorSize
	onModelClick: (model: ModelItem) => void
	selectedItemRef: React.RefObject<HTMLDivElement>
	getModelDescription: (model: ModelItem) => string | undefined
	modelKey?: "models" | "image_models"
	onModelsLoaded?: () => Promise<void> | void
}

export const ModelListContent = observer(function ModelListContent({
	modelList,
	selectedModel,
	searchKeyword,
	size,
	onModelClick,
	selectedItemRef,
	getModelDescription,
	modelKey = "models",
	onModelsLoaded,
}: ModelListContentProps) {
	const { isAdmin, isPersonalOrganization } = userStore.user
	const canManageModels = isPersonalOrganization || isAdmin
	const { t } = useTranslation("super")
	const visibleGroups = getVisibleGroups({ modelList, modelKey, searchKeyword })
	const isSearchResultEmpty = !!searchKeyword && visibleGroups.length === 0
	const EmptyStateIcon = isSearchResultEmpty ? SearchX : Sparkles
	const emptyStateTitle = isSearchResultEmpty
		? t("messageEditor.modelSwitch.noModelsFound")
		: t("messageEditor.modelSwitch.noModels")

	const handleModelClick = useMemoizedFn((model: ModelItem) => {
		if (!isModelDisabled(model)) {
			onModelClick(model)
		}
	})

	return (
		<>
			{canManageModels && (
				<MyModelsList
					modelKey={modelKey}
					selectedModel={selectedModel}
					onModelClick={onModelClick}
					selectedItemRef={selectedItemRef}
					onModelsLoaded={onModelsLoaded}
				/>
			)}
			{visibleGroups.length === 0 && (
				<ModelEmptyState
					icon={EmptyStateIcon}
					title={emptyStateTitle}
					description={
						isSearchResultEmpty
							? undefined
							: t("messageEditor.modelSwitch.noModelsDesc")
					}
					className={cn(canManageModels && "mt-2.5", "mb-2.5")}
					testId="model-list-empty-state"
				/>
			)}
			{visibleGroups.map((item) => (
				<ModelGroupSection
					key={item.group.id}
					item={item}
					selectedModel={selectedModel}
					size={size}
					onModelClick={handleModelClick}
					selectedItemRef={selectedItemRef}
					getModelDescription={getModelDescription}
				/>
			))}
		</>
	)
})

function getVisibleGroups({
	modelList,
	modelKey,
	searchKeyword,
}: {
	modelList: ModelListGroup[]
	modelKey: "models" | "image_models"
	searchKeyword: string
}): RenderableModelGroup[] {
	return modelList
		.map((item) => {
			const modelItems =
				modelKey === "image_models" ? (item.image_models ?? []) : (item.models ?? [])
			const displayModels = modelItems.filter((model) =>
				(model.model_name || model.model_id).includes(searchKeyword),
			)

			return {
				...item,
				displayModels,
			}
		})
		.filter((item) => item.displayModels.length > 0)
}
