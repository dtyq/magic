import type { ModelItem, ModelTabType } from "../types"
import { ReasoningEffortSelect } from "./ReasoningEffortSelect"

/** 用列表里的当前模型能力，并保留已选模型上的显式强度。 */
export function resolveReasoningFooterModel({
	activeTab,
	selectedModel,
	groups,
}: {
	activeTab: ModelTabType
	selectedModel?: ModelItem | null
	groups: Array<{ models?: ModelItem[] | null }>
}): ModelItem | null {
	if (activeTab !== "language" || !selectedModel) return null
	const current =
		groups
			.flatMap((group) => group.models ?? [])
			.find((model) => model.model_id === selectedModel.model_id) ?? selectedModel
	if (Object.prototype.hasOwnProperty.call(selectedModel, "reasoning_effort")) {
		return { ...current, reasoning_effort: selectedModel.reasoning_effort ?? null }
	}
	return current
}

interface ModelReasoningFooterProps {
	model: ModelItem
	onReasoningEffortChange: (model: ModelItem) => void
}

/**
 * 桌面面板底部的思考强度：当前选中语言模型，用与模型行悬停卡相同的选择器。
 * 移动端不用这个底栏，模式选择页有独立的「思考强度」行和底部弹层。
 */
export function ModelReasoningFooter({
	model,
	onReasoningEffortChange,
}: ModelReasoningFooterProps) {
	return (
		<div
			data-testid="model-switch-reasoning-footer"
			className="shrink-0 border-t border-border/70 px-1.5 py-1"
		>
			<ReasoningEffortSelect
				model={model}
				onReasoningEffortChange={onReasoningEffortChange}
				side="top"
				align="end"
			/>
		</div>
	)
}
