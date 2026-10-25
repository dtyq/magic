import { Check } from "lucide-react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import modelCache from "@/services/superMagic/topicModel/SuperMagicTopicModelCacheService"
import { cn } from "@/utils/cn"
import { useReasoningEffortLabels } from "../hooks/useReasoningEffortLabels"
import type { ModelItem, ReasoningEffort } from "../types"
import { getModelDisplayedReasoningEffort, getSelectableReasoningLevels } from "../utils"

interface ReasoningEffortOptionListProps {
	model: ModelItem
	/** 选中档位后回调带 reasoning_effort 的模型快照；「默认」回传 null 表示跟随后台。 */
	onReasoningEffortChange: (model: ModelItem) => void
}

/** 移动端的档位列表：「默认」加模型支持的档位，整行可点，选中项带勾号。 */
export function ReasoningEffortOptionList({
	model,
	onReasoningEffortChange,
}: ReasoningEffortOptionListProps) {
	const { labels, defaultLabel, title } = useReasoningEffortLabels()
	const levels = getSelectableReasoningLevels(model)
	const selected = getModelDisplayedReasoningEffort(model)
	const options: Array<ReasoningEffort | undefined> = [undefined, ...levels]

	function selectEffort(effort?: ReasoningEffort) {
		modelCache.setReasoningEffort(model, effort)
		onReasoningEffortChange({ ...model, reasoning_effort: effort ?? null })
	}

	return (
		<div role="group" aria-label={title} className="flex flex-col px-2">
			{options.map((level) => {
				const pressed = selected === level
				return (
					<button
						key={level ?? "default"}
						type="button"
						aria-pressed={pressed}
						onClick={() => selectEffort(level)}
						className={cn(
							"flex h-12 items-center justify-between rounded-xl px-3 text-base text-foreground transition-colors active:bg-muted/70",
							pressed && "font-medium",
						)}
						data-testid={`model-switch-reasoning-option-${level ?? "default"}`}
					>
						<span>{level ? labels[level] : defaultLabel}</span>
						{pressed ? <Check className="size-5" aria-hidden="true" /> : null}
					</button>
				)
			})}
		</div>
	)
}

interface ReasoningEffortSheetProps {
	visible: boolean
	onClose: () => void
	model: ModelItem
	onReasoningEffortChange: (model: ModelItem) => void
}

/**
 * 移动端的思考强度选择：底部弹层列出「默认」和模型支持的档位，点选即生效并关闭。
 * 与桌面的 ReasoningEffortSelect 共用同一套档位解析、文案和持久化。
 */
export function ReasoningEffortSheet({
	visible,
	onClose,
	model,
	onReasoningEffortChange,
}: ReasoningEffortSheetProps) {
	const { title } = useReasoningEffortLabels()

	return (
		<MagicPopup
			visible={visible}
			onClose={onClose}
			className="rounded-t-[14px] border-0 bg-card"
			bodyClassName="rounded-t-[14px] border-0 bg-card p-0 overflow-hidden"
		>
			<div
				className="flex flex-col pb-[max(var(--safe-area-inset-bottom),12px)]"
				data-testid="mobile-reasoning-effort-sheet"
			>
				<div className="px-5 pb-1 pt-4 text-sm font-medium text-muted-foreground">
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
		</MagicPopup>
	)
}
