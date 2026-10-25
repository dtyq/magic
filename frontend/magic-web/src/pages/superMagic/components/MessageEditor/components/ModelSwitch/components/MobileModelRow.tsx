import { Check, ChevronRight } from "lucide-react"
import { useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { ModelItem } from "../types"
import { getSelectableReasoningLevels } from "../utils"
import { ModelBillingMultiplier } from "./ModelBillingMultiplier"
import { hasModelInfo } from "./ModelInfoContent"
import { ModelInfoSheet } from "./ModelInfoSheet"
import ModelIcon from "./ModelIcon"

interface MobileModelRowProps {
	model: ModelItem
	selected: boolean
	disabled: boolean
	description?: string
	selectedItemRef: RefObject<HTMLDivElement>
	onSelect: (model: ModelItem) => void
	/** 介绍弹层里选档位时回调，语义与桌面悬停卡一致：当作选中该模型。 */
	onReasoningEffortChange?: (model: ModelItem) => void
	/** 行内显示模型自己的图标（不按供应商分组时使用）。 */
	showIcon?: boolean
}

/**
 * 移动端模型行，和桌面行同一结构：分组标题带供应商图标，行内不再重复图标并向右缩进一级；
 * 选中态用勾号、名称加粗和整行浅灰底表达，倍率用小字放右侧。
 * 行尾的「›」打开介绍弹层，内容与桌面悬停卡相同；它和选中按钮是两个并列控件，不互相触发。
 */
export function MobileModelRow({
	model,
	selected,
	disabled,
	description = model.model_description,
	selectedItemRef,
	onSelect,
	onReasoningEffortChange,
	showIcon = false,
}: MobileModelRowProps) {
	const { t } = useTranslation("super")
	const [infoOpen, setInfoOpen] = useState(false)
	const name = model.model_name || model.model_id
	const canSelectEffort =
		!disabled && getSelectableReasoningLevels(model).length > 0 && !!onReasoningEffortChange
	const showInfo = hasModelInfo(model, description) || canSelectEffort

	return (
		<div
			ref={selected ? selectedItemRef : null}
			className={cn(
				"flex min-w-0 items-center rounded-xl",
				// 按供应商分组时缩进一级；带模型图标平铺时不缩进。
				!showIcon && "ml-6",
				// 底色加在整行（含「›」），与桌面选中行一致。
				selected && "bg-muted",
				disabled && "opacity-50",
			)}
			data-testid="mobile-model-row"
		>
			<button
				type="button"
				disabled={disabled}
				onClick={() => onSelect(model)}
				aria-label={name}
				aria-pressed={selected}
				className={cn(
					"flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left",
					"transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60 disabled:cursor-not-allowed",
				)}
				data-testid="model-switch-item"
				data-model-id={model.model_id}
				data-model-name={model.model_name}
				data-selected={selected}
			>
				{showIcon ? (
					<ModelIcon model={model} size={18} className="shrink-0 rounded" />
				) : null}
				<span
					className={cn(
						"block min-w-0 flex-1 truncate text-[15px]",
						selected
							? "font-semibold text-foreground"
							: "font-normal text-foreground/80",
					)}
				>
					{name}
				</span>
				<ModelBillingMultiplier
					value={model.billing_multiplier}
					className="text-xs leading-4 [font-family:Inter,sans-serif]"
				/>
				{/* 固定勾选列，倍率在每一行保持同一条垂直基线。 */}
				<span
					className="flex size-5 shrink-0 items-center justify-center"
					aria-hidden="true"
				>
					{selected ? <Check className="size-4 text-foreground" strokeWidth={2} /> : null}
				</span>
			</button>
			{showInfo ? (
				<>
					{/* 44px 触控区，图标保持 16px；放在选中按钮之外，避免按钮嵌套。 */}
					<button
						type="button"
						onClick={() => setInfoOpen(true)}
						aria-label={t("messageEditor.modelSwitch.viewModelInfo")}
						className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60"
						data-testid="mobile-model-info-trigger"
					>
						<ChevronRight size={16} aria-hidden="true" />
					</button>
					<ModelInfoSheet
						visible={infoOpen}
						onClose={() => setInfoOpen(false)}
						model={model}
						description={description}
						onReasoningEffortChange={
							canSelectEffort ? onReasoningEffortChange : undefined
						}
					/>
				</>
			) : (
				// 没有介绍时留出同宽占位，让所有行的倍率和勾号仍在同一条基线上。
				<span className="size-11 shrink-0" aria-hidden="true" />
			)}
		</div>
	)
}
