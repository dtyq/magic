import { History, Trash2 } from "lucide-react"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import type {
	TimeFilterHistoryItem,
	TimePrecision,
} from "@magic-admin-v2/components/time-filter-panel/types"
import {
	formatTimeRangeByPrecision,
	getTimeRangeDisplayLabel,
} from "@magic-admin-v2/components/time-filter-panel/utils"
import { timeFilterTab } from "@magic-admin-v2/components/time-filter-panel/types"
import { useTranslation } from "react-i18next"
import { cn } from "@magic-admin-v2/utils/cn"

/** 历史记录 Tab 的展示契约；选择和删除操作由父级负责持久化。 */
type HistoryTimeTabProps = {
	/** 已保存的时间范围历史记录，通常按最近使用顺序排列。 */
	history: TimeFilterHistoryItem[]
	/** 是否将面板直接渲染在页面中；影响历史记录列表的最大高度。 */
	isInline: boolean
	/** 是否只使用自然日精度展示相对时间记录。 */
	isRelativeDayOnly: boolean
	/** 绝对时间记录的展示精度。 */
	timePrecision: TimePrecision
	/** 删除指定历史记录。 */
	onRemove: (id: string) => void
	/** 选择历史记录并恢复到面板当前范围。 */
	onSelect: (item: TimeFilterHistoryItem) => void
}

export function HistoryTimeTab({
	history,
	isInline,
	isRelativeDayOnly,
	timePrecision,
	onRemove,
	onSelect,
}: HistoryTimeTabProps) {
	const { t } = useTranslation()

	if (history.length === 0) {
		return (
			<EmptyState
				description={t("timeFilter.emptyHistoryDescription")}
				icon={History}
				testId="time-filter-history-empty"
				title={t("timeFilter.emptyHistory")}
			/>
		)
	}

	return (
		<div
			className={cn("grid gap-2", !isInline && "max-h-[360px] overflow-y-auto pr-1")}
			data-testid="time-filter-history-list"
		>
			{history.map((item) => (
				<button
					className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
					data-testid="time-filter-history-item"
					key={item.id}
					onClick={() => onSelect(item)}
					type="button"
				>
					<div className="min-w-0">
						<div className="truncate text-sm font-medium">
							{getTimeRangeDisplayLabel(item, t, timePrecision)}
						</div>
						<div className="mt-1 truncate font-mono text-xs text-muted-foreground">
							{formatTimeRangeByPrecision(
								item.startDate,
								item.endDate,
								item.tab === timeFilterTab.absolute
									? timePrecision
									: isRelativeDayOnly
										? "day"
										: "second",
							)}
						</div>
					</div>
					<span
						aria-label={t("timeFilter.remove")}
						className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
						data-testid="time-filter-history-remove-button"
						onClick={(event) => {
							event.stopPropagation()
							onRemove(item.id)
						}}
						role="button"
					>
						<Trash2 className="size-4" aria-hidden="true" />
					</span>
				</button>
			))}
		</div>
	)
}
