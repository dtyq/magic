import MagicPopup from "@/components/base-mobile/MagicPopup"
import { useReasoningEffortLabels } from "../hooks/useReasoningEffortLabels"
import type { ModelItem } from "../types"
import { getSelectableReasoningLevels } from "../utils"
import { ModelInfoContent } from "./ModelInfoContent"
import { ReasoningEffortOptionList } from "./ReasoningEffortSheet"

interface ModelInfoSheetProps {
	visible: boolean
	onClose: () => void
	model: ModelItem
	description?: string
	/**
	 * 在弹层里选择档位时回调带 reasoning_effort 的模型快照，语义与桌面悬停卡一致：
	 * 调用方把它当作选中该模型。不传则弹层只展示介绍。
	 */
	onReasoningEffortChange?: (model: ModelItem) => void
}

/** 移动端的模型介绍弹层：内容与桌面悬停卡相同，思考强度以整行列表呈现，点选后关闭。 */
export function ModelInfoSheet({
	visible,
	onClose,
	model,
	description,
	onReasoningEffortChange,
}: ModelInfoSheetProps) {
	const { title } = useReasoningEffortLabels()
	const canSelectEffort =
		getSelectableReasoningLevels(model).length > 0 && !!onReasoningEffortChange

	return (
		<MagicPopup
			visible={visible}
			onClose={onClose}
			className="rounded-t-[14px] border-0 bg-card"
			bodyClassName="rounded-t-[14px] border-0 bg-card p-0 overflow-hidden"
		>
			<div
				className="flex max-h-[min(70vh,calc(100vh-var(--safe-area-inset-top)-44px))] flex-col overflow-y-auto pb-[max(var(--safe-area-inset-bottom),12px)]"
				data-testid="mobile-model-info-sheet"
			>
				<ModelInfoContent model={model} description={description} size="sheet" />
				{canSelectEffort && onReasoningEffortChange ? (
					<div className="border-t border-border/70 pt-1">
						<div className="px-5 pb-1 pt-3 text-sm font-medium text-muted-foreground">
							{title}
						</div>
						<ReasoningEffortOptionList
							model={model}
							onReasoningEffortChange={(next) => {
								onReasoningEffortChange(next)
								onClose()
							}}
						/>
					</div>
				) : null}
			</div>
		</MagicPopup>
	)
}
