import { forwardRef } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface MobileListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "prefix"> {
	prefix?: ReactNode
	suffix?: ReactNode
	arrowIcon?: ReactNode
	onClick?: () => void
}

const MobileListItem = forwardRef<HTMLDivElement, MobileListItemProps>(
	({ className, children, prefix, suffix, arrowIcon, onClick, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					"flex items-center h-[60px] px-4 rounded-lg cursor-pointer",
					className,
				)}
				onClick={onClick}
				{...props}
			>
				{prefix && <div className="pr-2">{prefix}</div>}
				<div className="flex-1 text-sm text-secondary-foreground">{children}</div>
				{suffix && <div className="pl-2">{suffix}</div>}
				{arrowIcon && <div className="pl-2 text-muted-foreground">{arrowIcon}</div>}
			</div>
		)
	},
)
MobileListItem.displayName = "MobileListItem"

export interface MobileListProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode
}

const MobileList = forwardRef<HTMLDivElement, MobileListProps>(
	({ className, children, ...props }, ref) => {
		return (
			<div ref={ref} className={cn("h-full overflow-y-auto", className)} {...props}>
				{children}
			</div>
		)
	},
)
MobileList.displayName = "MobileList"

export { MobileList, MobileListItem }
