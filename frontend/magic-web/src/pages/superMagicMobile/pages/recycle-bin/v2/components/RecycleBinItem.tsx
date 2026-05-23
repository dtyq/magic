import { memo, useMemo } from "react"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import { formatRelativeTime } from "@/utils/string"

export interface RecycleBinItemData {
	id: string
	type: "workspace" | "project" | "topic" | "file"
	title: string
	deletedBy: string
	deletedByUser?: { nickname: string; avatar: string }
	/** ISO，用于列表展示删除时间 */
	deletedAt?: string
	validDays: number
	resourceId: string
	resourceType: number
	selected?: boolean
	path?: string
}

interface RecycleBinItemProps {
	item: RecycleBinItemData
	onSelectionChange: (id: string, selected: boolean) => void
}

/** 对齐原型 `TrashTypeBadge` */
function RecycleBinTypeBadge(props: { label: string }) {
	return (
		<span className="inline-flex h-4 shrink-0 items-center rounded-full border border-border bg-muted px-1.5">
			<span className="text-[11px] leading-none text-foreground">{props.label}</span>
		</span>
	)
}

function RecycleBinItem(props: RecycleBinItemProps) {
	const { item, onSelectionChange } = props
	const { t, i18n } = useTranslation("super")

	const deletedTimeLabel = useMemo(() => {
		if (!item.deletedAt) return ""
		return formatRelativeTime(i18n.language)(item.deletedAt)
	}, [item.deletedAt, i18n.language])

	const retentionLabel = t("mobile.recycleBin.item.remainingShort", { days: item.validDays })
	const typeLabel = t(`mobile.recycleBin.item.type.${item.type}`)

	const hasDeletedTime = Boolean(deletedTimeLabel)
	const hasDeletedBy = Boolean(item.deletedBy?.trim())

	return (
		<button
			type="button"
			aria-pressed={item.selected ?? false}
			aria-label={t("mobile.recycleBin.item.selectRow")}
			data-testid={`mobile-recycle-bin-item-${item.id}`}
			onClick={() => onSelectionChange(item.id, !item.selected)}
			className="relative flex min-h-16 w-full shrink-0 overflow-hidden transition-opacity active:opacity-70"
		>
			<div className="flex w-full shrink-0 items-start gap-2 rounded-lg px-3 py-[10px]">
				<MobileResourceTypeIcon type={item.type} className="mt-0.5" />

				<div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
					<p className="w-full truncate text-left text-[16px] font-medium leading-6 text-foreground">
						{item.title}
					</p>
					<p
						className="min-h-4 w-full truncate pb-1 text-left text-[12px] font-light leading-4 text-muted-foreground"
						aria-hidden={!item.path}
					>
						{item.path?.trim() ? item.path : "\u00a0"}
					</p>
					<div className="flex w-full min-w-0 items-center gap-1.5">
						<RecycleBinTypeBadge label={typeLabel} />
						<p className="min-w-0 flex-1 truncate text-left text-[12px] font-light leading-4 text-muted-foreground">
							{hasDeletedTime ? deletedTimeLabel : null}
							{hasDeletedTime && hasDeletedBy ? (
								<span className="mx-1 opacity-50">·</span>
							) : null}
							{hasDeletedBy ? item.deletedBy : null}
							{hasDeletedTime || hasDeletedBy ? (
								<span className="mx-1 opacity-50">·</span>
							) : null}
							<span className="tabular-nums text-orange-500 dark:text-orange-400">
								{retentionLabel}
							</span>
						</p>
					</div>
				</div>

				<div
					className="mt-0.5 flex size-9 shrink-0 items-center justify-center self-start rounded-full"
					data-testid={`mobile-recycle-bin-item-checkbox-${item.id}`}
					aria-hidden
				>
					{item.selected ? (
						<div className="flex size-[22px] items-center justify-center rounded-full bg-primary">
							<Check className="size-3.5 text-primary-foreground" strokeWidth={2.5} />
						</div>
					) : (
						<div className="size-[22px] shrink-0 rounded-full border-2 border-muted-foreground/35" />
					)}
				</div>
			</div>
		</button>
	)
}

export default memo(RecycleBinItem)
