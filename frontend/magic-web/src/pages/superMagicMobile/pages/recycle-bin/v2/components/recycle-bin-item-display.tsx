import {
	MobileResourceTypeIcon,
	RECYCLE_BIN_TYPE_ICON_CELL,
	RECYCLE_BIN_TYPE_ICONS,
} from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"

export { RECYCLE_BIN_TYPE_ICONS, RECYCLE_BIN_TYPE_ICON_CELL }

interface RecycleBinTypeBadgeProps {
	label: string
}

/** Compact type pill used in orphan warn rows. */
export function RecycleBinTypeBadge(props: RecycleBinTypeBadgeProps) {
	return (
		<span className="inline-flex h-4 shrink-0 items-center rounded-full border border-border bg-muted px-1.5">
			<span className="text-[11px] leading-none text-foreground">{props.label}</span>
		</span>
	)
}

interface RecycleBinOrphanRowProps {
	type: string
	title: string
	path?: string
	typeLabel: string
}

/** Read-only row for orphan warn sheet (matches prototype orphan list card). */
export function RecycleBinOrphanRow(props: RecycleBinOrphanRowProps) {
	const { type, title, path, typeLabel } = props

	return (
		<div className="flex items-start gap-2 px-[14px] py-3">
			<MobileResourceTypeIcon type={type} className="mt-0.5" iconSizeClass="size-5" />
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-1.5">
					<p className="min-w-0 truncate text-[14px] leading-5 text-foreground">
						{title}
					</p>
					<RecycleBinTypeBadge label={typeLabel} />
				</div>
				{path?.trim() ? (
					<p className="mt-0.5 truncate text-[12px] leading-4 text-muted-foreground">
						{path}
					</p>
				) : null}
			</div>
		</div>
	)
}
