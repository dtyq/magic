import { cn } from "@/utils/cn"

interface NotificationUnreadBadgeProps {
	label: string | null
	className?: string
	testId?: string
	variant?: "entry" | "system" | "auth"
}

function NotificationUnreadBadge({
	label,
	className,
	testId = "inbox-unread-badge",
	variant = "entry",
}: NotificationUnreadBadgeProps) {
	if (!label) return null

	return (
		<span
			data-testid={testId}
			className={cn(
				"inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full text-[11px] tabular-nums leading-none",
				variant === "entry"
					? "h-[22px] min-w-6 px-1.5 font-semibold"
					: "h-[18px] min-w-5 px-1.5 font-normal",
				variant === "system"
					? "bg-[#f1f2f5] text-[#858b99] dark:bg-muted dark:text-muted-foreground"
					: "bg-[#f04438] text-white",
				className,
			)}
		>
			{label}
		</span>
	)
}

export default NotificationUnreadBadge
