import type { ComponentProps, ReactNode } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"

export type RecordSummaryAlertTone = "neutral" | "success" | "danger"
export type RecordSummaryAlertActionAppearance = "primary" | "secondary" | "danger"

interface RecordSummaryAlertIconProps {
	tone?: RecordSummaryAlertTone
	children: ReactNode
	className?: string
}

interface RecordSummaryActionButtonProps extends ComponentProps<typeof Button> {
	appearance?: RecordSummaryAlertActionAppearance
	fullWidth?: boolean
}

interface RecordSummaryAlertCardProps extends Omit<ComponentProps<"div">, "title"> {
	title: ReactNode
	description?: ReactNode
	icon: ReactNode
	tone?: RecordSummaryAlertTone
	footer?: ReactNode
	bodyClassName?: string
	contentClassName?: string
}

export function RecordSummaryAlertIcon({
	tone = "neutral",
	children,
	className,
}: RecordSummaryAlertIconProps) {
	return (
		<div
			className={cn(
				"flex size-10 shrink-0 items-center justify-center rounded-md",
				tone === "neutral" && "bg-muted text-foreground",
				tone === "success" && "bg-emerald-50 text-emerald-500",
				tone === "danger" && "bg-red-50 text-red-500",
				className,
			)}
		>
			{children}
		</div>
	)
}

export function RecordSummaryActionButton({
	appearance = "secondary",
	fullWidth = false,
	className,
	...props
}: RecordSummaryActionButtonProps) {
	const variant = appearance === "primary" ? "default" : "outline"

	return (
		<Button
			size="sm"
			variant={variant}
			className={cn(
				"h-8 rounded-md px-3 text-xs font-medium shadow-xs",
				fullWidth && "w-full",
				appearance === "primary" && "bg-foreground text-background hover:bg-foreground/90",
				appearance === "secondary" && "bg-background hover:bg-accent",
				appearance === "danger" &&
				"border-transparent bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700",
				className,
			)}
			{...props}
		/>
	)
}

export function RecordSummaryAlertCard({
	title,
	description,
	icon,
	tone = "neutral",
	footer,
	className,
	bodyClassName,
	contentClassName,
	...props
}: RecordSummaryAlertCardProps) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-[14px] bg-background shadow-[0_10px_15px_-3px_rgba(0,0,0,0.10),0_4px_6px_-4px_rgba(0,0,0,0.10)]",
				className,
			)}
			{...props}
		>
			<div className={cn("flex items-start gap-3.5 p-4", bodyClassName)}>
				<RecordSummaryAlertIcon tone={tone}>{icon}</RecordSummaryAlertIcon>
				<div className={cn("min-w-0 flex-1", contentClassName)}>
					<div className="text-base font-semibold leading-6 text-foreground">{title}</div>
					{description ? (
						<div className="mt-1.5 text-sm leading-5 text-muted-foreground">
							{description}
						</div>
					) : null}
				</div>
			</div>
			{footer ? (
				<div className="flex items-center justify-end gap-2 border-t border-border bg-muted/60 p-4">
					{footer}
				</div>
			) : null}
		</div>
	)
}
