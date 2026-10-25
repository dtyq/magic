import type { ReactNode } from "react"
import { cn } from "@/utils/cn"
import { DropdownMenuItem, DropdownMenuSubTrigger } from "@/components/shadcn-ui/dropdown-menu"

/** Shared trigger styles for export/share text actions in the detail header. */
export const RECORDING_DETAIL_HEADER_TEXT_ACTION_CLASS =
	"inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted data-[state=open]:border-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"

/** Shared trigger styles for the bordered more icon button. */
export const RECORDING_DETAIL_HEADER_ICON_ACTION_CLASS =
	"inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted data-[state=open]:border-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"

/** Dropdown panel styles aligned with the recording detail Web prototype. */
export const RECORDING_DETAIL_HEADER_MENU_CONTENT_CLASS =
	"w-44 rounded-xl border border-border bg-card py-1 text-[13px] shadow-[0px_10px_30px_0px_rgba(0,0,0,0.14)]"

/** Primary CTA height/typography to sit flush with header action buttons. */
export const RECORDING_DETAIL_HEADER_PRIMARY_ACTION_CLASS =
	"inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-semibold"

interface RecordingDetailHeaderMenuItemProps {
	icon?: ReactNode
	children: ReactNode
	className?: string
	disabled?: boolean
	title?: string
	onClick?: () => void
	"data-testid"?: string
}

/** Normalizes dropdown row height/spacing to match the prototype action menu. */
export function RecordingDetailHeaderMenuItem({
	icon,
	children,
	className,
	disabled = false,
	title,
	onClick,
	"data-testid": dataTestId,
}: RecordingDetailHeaderMenuItemProps) {
	return (
		<DropdownMenuItem
			disabled={disabled}
			title={title}
			data-testid={dataTestId}
			className={cn(
				"flex h-9 cursor-pointer items-center gap-2 px-3 text-[13px] font-medium leading-4",
				className,
			)}
			onClick={onClick}
		>
			{icon ? (
				<span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
			) : null}
			<span className="min-w-0 flex-1 truncate">{children}</span>
		</DropdownMenuItem>
	)
}

/** Submenu parent row aligned with the primary export menu typography. */
export function RecordingDetailHeaderSubMenuTrigger({
	children,
	disabled = false,
	className,
	"data-testid": dataTestId,
}: {
	children: ReactNode
	disabled?: boolean
	className?: string
	"data-testid"?: string
}) {
	return (
		<DropdownMenuSubTrigger
			disabled={disabled}
			data-testid={dataTestId}
			className={cn(
				"flex h-9 cursor-pointer items-center gap-2 px-3 text-[13px] font-medium leading-4",
				className,
			)}
		>
			<span className="min-w-0 flex-1 truncate">{children}</span>
		</DropdownMenuSubTrigger>
	)
}
