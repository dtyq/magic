import { Check, TriangleAlert } from "lucide-react"
import FlexBox from "@/components/base/FlexBox"
import { cn } from "@/utils/cn"
import type React from "react"
import type { ReactNode } from "react"
import type { ModelItem, ModelListGroup, MessageEditorSize, ModelSelectionState } from "../types"
import { isModelDisabled } from "../utils"
import { ModelInfoHoverCard } from "./ModelInfoHoverCard"
import ModelIcon from "./ModelIcon"
import ModelName from "./ModelName"
import ModelTags from "./ModelTags"
import ProviderName from "./ProviderName"
import { ModelBillingMultiplier } from "./ModelBillingMultiplier"
import { MobileModelRow } from "./MobileModelRow"

export interface RenderableModelGroup extends ModelListGroup {
	displayModels: ModelItem[]
}

interface ModelGroupSectionProps {
	item: RenderableModelGroup
	selectedModel: ModelItem | null
	size: MessageEditorSize
	onModelClick: (model: ModelItem) => void
	/** 桌面信息卡里选档位时回调；调用方把它当作选中该模型。 */
	onReasoningEffortChange?: (model: ModelItem) => void
	selectedItemRef: React.RefObject<HTMLDivElement>
	getModelDescription: (model: ModelItem) => string | undefined
	/** 桌面行悬停显示信息卡；移动端弹层没有悬停，传 false。 */
	showModelInfo?: boolean
	/** 替换默认的供应商标题（例如「平台模型」分组）；传 null 表示不显示标题。 */
	header?: ReactNode
	/** 行内显示模型自己的图标；按供应商分组时标题已带图标，不需要。 */
	showModelIcon?: boolean
	getModelState?: (model: ModelItem) => ModelSelectionState | undefined
}

export function ModelGroupSection({
	item,
	selectedModel,
	size,
	onModelClick,
	onReasoningEffortChange,
	selectedItemRef,
	getModelDescription,
	showModelInfo = true,
	header,
	showModelIcon = false,
	getModelState,
}: ModelGroupSectionProps) {
	const isMobile = size === "mobile"

	return (
		<FlexBox gap={1} vertical className="last:border-b-0 last:pb-0">
			{header === undefined ? <ProviderName item={item.group} /> : header}
			<div className="flex flex-col gap-0.5">
				{item.displayModels.map((model) => {
					const modelState = getModelState?.(model)
					const isSelectionDisabled = modelState?.disabled ?? false
					// 场景受限的原模型仍用作滚动定位，但不再显示可切换候选的勾选。
					const isCurrentModel = selectedModel?.model_id === model.model_id
					const isSelected = isCurrentModel && !isSelectionDisabled
					const isDisabled = isModelDisabled(model)
					const isUnavailable = isDisabled || isSelectionDisabled
					const description = modelState?.reason ?? getModelDescription(model)
					if (isMobile) {
						return (
							<MobileModelRow
								key={model.model_id}
								model={model}
								selected={isSelected}
								disabled={isUnavailable}
								description={description}
								selectedItemRef={selectedItemRef}
								onSelect={onModelClick}
								onReasoningEffortChange={onReasoningEffortChange}
								showIcon={showModelIcon}
							/>
						)
					}
					const ariaLabel = description
						? `${model.model_name || model.model_id}，${description}`
						: model.model_name || model.model_id

					// 桌面紧凑行，语言、生图、视频三个 Tab 共用：
					// 按供应商分组时标题已带供应商图标，行内不再重复并缩进一级；平台模型平铺时行内显示模型图标、不缩进；
					// 选中态用勾号、名称加粗和比悬停更深一档的底色表达，未选中名称为常规字重；描述放进悬停信息卡。
					const row = (
						<div
							key={model.model_id}
							ref={isCurrentModel ? selectedItemRef : null}
							className={cn(
								"flex h-8 items-center gap-2 rounded-lg px-2",
								// 按供应商分组时行缩进一级形成层级；平台模型平铺带图标，不缩进，图标与分组标题左对齐。
								!showModelIcon && "ml-5",
								"cursor-pointer transition-colors duration-100",
								// 选中底色比悬停（muted/60）深一档，悬停在选中行上也保持选中底色。
								isSelected
									? "bg-muted"
									: "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/60",
								"outline-none focus-visible:ring-2 focus-visible:ring-ring",
								isDisabled && "cursor-not-allowed opacity-50",
								isSelectionDisabled && "cursor-not-allowed",
								modelState && "h-auto min-h-12 py-2",
							)}
							onClick={() => {
								if (!isSelectionDisabled) onModelClick(model)
							}}
							role="button"
							tabIndex={isUnavailable ? -1 : 0}
							onKeyDown={(event) => {
								if (isUnavailable) return
								if (event.key !== "Enter" && event.key !== " ") return
								event.preventDefault()
								onModelClick(model)
							}}
							aria-label={ariaLabel}
							aria-pressed={isSelected}
							aria-disabled={isUnavailable || undefined}
							title={description}
							data-testid="model-switch-item"
							data-model-id={model.model_id}
							data-model-name={model.model_name}
							data-selected={isSelected}
						>
							<FlexBox gap={2} align="center" flex={1} className="min-w-0">
								{showModelIcon ? (
									<ModelIcon
										model={model}
										size={16}
										// FlexBox 的 gap 只有 2px，补到 8px，与企业模型行的图标间距一致。
										className="mr-1.5 shrink-0 rounded"
									/>
								) : null}
								<ModelName
									model={model}
									isSelected={false}
									className={cn(
										// 覆盖 ModelName 自带的 120px 上限，名称尽量完整显示，只在真的放不下时截断。
										"min-w-0 !max-w-none flex-1 !text-[13px]",
										isSelected
											? "!font-semibold !text-foreground"
											: "!font-normal text-foreground/80",
										isDisabled && "opacity-50",
									)}
								/>
								<ModelTags model={model} />
								{modelState && (
									<span className="inline-flex shrink-0 items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
										<TriangleAlert className="size-4" aria-hidden />
										{modelState.label}
									</span>
								)}
							</FlexBox>
							{/* 倍率用 Inter 小字，和名称拉开层级，也不抢名称的宽度。 */}
							<ModelBillingMultiplier
								value={model.billing_multiplier}
								className="text-[11px] leading-4 [font-family:Inter,sans-serif]"
							/>
							{/* 固定勾选列，倍率在每一行保持同一条垂直基线。 */}
							<span
								className="flex size-5 shrink-0 items-center justify-center"
								aria-hidden="true"
							>
								{isSelected ? (
									<Check
										className="size-4 text-foreground"
										strokeWidth={2}
										data-testid="model-switch-item-selected-icon"
									/>
								) : null}
							</span>
						</div>
					)
					if (!showModelInfo) return row
					return (
						<ModelInfoHoverCard
							key={model.model_id}
							model={model}
							description={description}
							onReasoningEffortChange={
								isUnavailable ? undefined : onReasoningEffortChange
							}
						>
							{row}
						</ModelInfoHoverCard>
					)
				})}
			</div>
		</FlexBox>
	)
}
