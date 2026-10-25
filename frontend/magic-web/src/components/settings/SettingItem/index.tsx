import { useIsMobile } from "@/hooks/useIsMobile"
import { memo, type ReactNode } from "react"
import { cn } from "@/utils/cn"

interface SettingItemProps {
	icon?: ReactNode
	title: ReactNode
	description?: ReactNode
	extra?: ReactNode
	/**
	 * Stack the setting and its control on mobile when enabled.
	 * Otherwise preserve the horizontal layout at every viewport size.
	 */
	adaptMobile?: boolean
}

/**
 * Shared setting row with optional icon, description, and caller-provided control.
 * Desktop minimum widths align controls across rows; mobile releases those widths
 * and only stacks the control when adaptMobile is explicitly enabled.
 */
const SettingItem = memo(
	({ icon, title, description, extra, adaptMobile = false }: SettingItemProps) => {
		const isMobile = useIsMobile()
		const stacked = adaptMobile && isMobile

		return (
			<div
				className={cn(
					"flex gap-2.5 border-b border-border px-5 py-3 last:border-b-0",
					stacked ? "flex-col" : "items-center justify-between",
				)}
			>
				<div className="flex items-center gap-2.5">
					{icon}
					<div
						className={cn(
							"flex flex-1 gap-0.5",
							stacked ? "items-center justify-between" : "flex-col items-start",
						)}
					>
						<div
							className={cn(
								"text-base font-normal leading-[22px] text-foreground/80 dark:text-neutral-100",
								!isMobile && "min-w-[200px]",
							)}
						>
							{title}
						</div>
						{description ? (
							<div className="text-left text-sm font-normal leading-5 text-foreground/40 dark:text-neutral-500">
								{description}
							</div>
						) : null}
					</div>
				</div>
				<div
					className={cn(
						"flex shrink-0",
						!isMobile && "min-w-[270px]",
						stacked ? "justify-start" : "items-center justify-end",
					)}
				>
					{extra}
				</div>
			</div>
		)
	},
)

export default SettingItem
