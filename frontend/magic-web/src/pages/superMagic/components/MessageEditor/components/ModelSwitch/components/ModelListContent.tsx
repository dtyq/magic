import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import { SearchX, Sparkles } from "lucide-react"
import { MyModelsList, getVisibleMyModelGroups } from "./MyModelsList"
import { useOptionalAddModelStore } from "./AddModel/context"
import type {
	ModelItem,
	ModelListGroup,
	MessageEditorSize,
	ModelListKey,
	ModelSelectionState,
} from "../types"
import type React from "react"
import { useTranslation } from "react-i18next"
import { isModelDisabled } from "../utils"
import { ModelEmptyState } from "./ModelEmptyState"
import { ModelGroupSection, type RenderableModelGroup } from "./ModelGroupSection"
import { ModelSectionHeader } from "./ModelSectionHeader"

interface ModelListContentProps {
	allowModelManagement?: boolean
	modelList: ModelListGroup[]
	selectedModel: ModelItem | null
	searchKeyword: string
	size: MessageEditorSize
	onModelClick: (model: ModelItem) => void
	/** 桌面信息卡里选档位时回调；调用方把它当作选中该模型。 */
	onReasoningEffortChange?: (model: ModelItem) => void
	selectedItemRef: React.RefObject<HTMLDivElement>
	getModelDescription: (model: ModelItem) => string | undefined
	getModelState?: (model: ModelItem) => ModelSelectionState | undefined
	modelKey?: ModelListKey
	onModelsLoaded?: () => Promise<void> | void
	/** 桌面语言模型行悬停显示只读信息卡并带列标题；移动端弹层传 false。 */
	showModelInfo?: boolean
}

export const ModelListContent = observer(function ModelListContent({
	modelList,
	selectedModel,
	searchKeyword,
	size,
	onModelClick,
	onReasoningEffortChange,
	selectedItemRef,
	getModelDescription,
	getModelState,
	modelKey = "models",
	onModelsLoaded,
	showModelInfo = true,
	allowModelManagement,
}: ModelListContentProps) {
	const { t } = useTranslation("super")
	const visibleGroups = getVisibleGroups({ modelList, modelKey, searchKeyword })
	const platformGroup = mergePlatformGroups(visibleGroups)
	// 「我的模型 / 企业模型」分组的数据与 MyModelsList 同源（AddModelStore）。
	const addModelStore = useOptionalAddModelStore()
	const hasMyModels =
		!!addModelStore && getVisibleMyModelGroups(addModelStore.myModels, modelKey).length > 0
	const isSearchResultEmpty = !!searchKeyword && visibleGroups.length === 0
	const EmptyStateIcon = isSearchResultEmpty ? SearchX : Sparkles
	const emptyStateTitle = isSearchResultEmpty
		? t("messageEditor.modelSwitch.noModelsFound")
		: t("messageEditor.modelSwitch.noModels")
	const handleModelClick = useMemoizedFn((model: ModelItem) => {
		if (!getModelState?.(model)?.disabled && !isModelDisabled(model)) {
			onModelClick(model)
		}
	})
	const handleReasoningEffortChange = useMemoizedFn((model: ModelItem) => {
		if (!getModelState?.(model)?.disabled && !isModelDisabled(model)) {
			onReasoningEffortChange?.(model)
		}
	})

	return (
		<>
			<MyModelsList
				modelKey={modelKey}
				selectedModel={selectedModel}
				onModelClick={onModelClick}
				selectedItemRef={selectedItemRef}
				onModelsLoaded={onModelsLoaded}
				compact={showModelInfo}
				getModelState={getModelState}
				allowModelManagement={allowModelManagement}
			/>
			{/* 平台模型和「我的模型 / 企业模型」都没有时才显示空状态；只有企业模型时不再在下方追加空状态。 */}
			{visibleGroups.length === 0 && !hasMyModels && (
				<ModelEmptyState
					icon={EmptyStateIcon}
					title={emptyStateTitle}
					description={
						isSearchResultEmpty
							? undefined
							: t("messageEditor.modelSwitch.noModelsDesc")
					}
					className={cn("mt-2.5", "mb-2.5")}
					testId="model-list-empty-state"
				/>
			)}
			{/* 暂时不按供应商分组展示，平台模型合并为下方的一组；保留原分组渲染，后续可能恢复。
			{visibleGroups.map((item) => (
				<ModelGroupSection
					key={item.group.id}
					item={item}
					selectedModel={selectedModel}
					size={size}
					onModelClick={handleModelClick}
					onReasoningEffortChange={
						onReasoningEffortChange ? handleReasoningEffortChange : undefined
					}
					selectedItemRef={selectedItemRef}
					getModelDescription={getModelDescription}
					showModelInfo={showModelInfo}
					getModelState={getModelState}
				/>
			))}
			*/}
			{platformGroup ? (
				<ModelGroupSection
					item={platformGroup}
					// 只有平台模型一组时标题没有区分作用，不显示；与「我的模型 / 企业模型」并列时才显示。
					header={
						hasMyModels ? (
							<ModelSectionHeader
								title={t("messageEditor.modelSwitch.platformModels")}
								testId="platform-models-header"
							/>
						) : null
					}
					showModelIcon
					selectedModel={selectedModel}
					size={size}
					onModelClick={handleModelClick}
					onReasoningEffortChange={
						onReasoningEffortChange ? handleReasoningEffortChange : undefined
					}
					selectedItemRef={selectedItemRef}
					getModelDescription={getModelDescription}
					showModelInfo={showModelInfo}
					getModelState={getModelState}
				/>
			) : null}
		</>
	)
})

function getVisibleGroups({
	modelList,
	modelKey,
	searchKeyword,
}: {
	modelList: ModelListGroup[]
	modelKey: ModelListKey
	searchKeyword: string
}): RenderableModelGroup[] {
	return modelList
		.map((item) => {
			const modelItems =
				modelKey === "image_models"
					? (item.image_models ?? [])
					: modelKey === "video_models"
						? (item.video_models ?? [])
						: (item.models ?? [])
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

/**
 * 把各供应商分组的可见模型合并成一组「平台模型」，按原有分组与排序依次展开。
 * 同一模型可能同时出现在「推荐」和供应商分组里，按 model_id 去重，只保留第一次出现的位置。
 */
function mergePlatformGroups(groups: RenderableModelGroup[]): RenderableModelGroup | null {
	if (groups.length === 0) return null
	const seen = new Set<string>()
	const displayModels: ModelItem[] = []
	for (const group of groups) {
		for (const model of group.displayModels) {
			if (seen.has(model.model_id)) continue
			seen.add(model.model_id)
			displayModels.push(model)
		}
	}
	// 分组标题由调用方替换为「平台模型」，这里沿用第一个分组只为满足 ModelGroupSection 的数据结构。
	return { ...groups[0], displayModels }
}
