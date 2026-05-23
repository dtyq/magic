import { Box, FileText, LibraryBig, MessageSquare, type LucideIcon } from "lucide-react"

/** Shared list row visuals for recycle bin items (aligned with prototype TrashScreen). */
export const RECYCLE_BIN_TYPE_ICONS: Record<string, LucideIcon> = {
	workspace: Box,
	project: LibraryBig,
	topic: MessageSquare,
	file: FileText,
}

export const RECYCLE_BIN_TYPE_ICON_CELL: Record<string, { box: string; icon: string }> = {
	workspace: { box: "bg-[#F5F3FF]", icon: "text-[#7C3AED]" },
	project: { box: "bg-[#EFF6FF]", icon: "text-[#2563EB]" },
	topic: { box: "bg-[#ECFDF5]", icon: "text-[#059669]" },
	file: { box: "bg-[#FEFCE8]", icon: "text-[#CA8A04]" },
}

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
	const cell = RECYCLE_BIN_TYPE_ICON_CELL[type] || RECYCLE_BIN_TYPE_ICON_CELL.file
	const Icon = RECYCLE_BIN_TYPE_ICONS[type] || RECYCLE_BIN_TYPE_ICONS.file

	return (
		<div className="flex items-start gap-2 px-[14px] py-3">
			<div
				className={`${cell.box} mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px]`}
				aria-hidden
			>
				<Icon className={`h-5 w-5 ${cell.icon}`} strokeWidth={1.75} />
			</div>
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
