import { Button } from "@/components/shadcn-ui/button"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MenuButtonProps {
	icon: React.ReactNode
	label: string
	iconClassName?: string
	labelClassName?: string
	arrowLabel?: string
	showArrow?: boolean
	onClick?: () => void
	"data-testid"?: string
	className?: string
}

function MenuButton({
	icon,
	label,
	iconClassName,
	labelClassName,
	arrowLabel,
	showArrow = true,
	onClick,
	"data-testid": dataTestId,
	className,
}: MenuButtonProps) {
	return (
		<Button
			variant="ghost"
			onClick={onClick}
			data-testid={dataTestId}
			className={cn("flex h-11 w-full items-center gap-2 bg-fill px-3 py-2", className)}
		>
			<div
				className={cn(
					"flex size-4 items-center justify-center text-foreground",
					iconClassName,
				)}
			>
				{icon}
			</div>
			<div
				className={cn(
					"flex flex-1 text-sm font-normal leading-5 text-foreground",
					labelClassName,
				)}
			>
				{label}
			</div>
			{arrowLabel && <div className="text-xs text-muted-foreground">{arrowLabel}</div>}
			{showArrow && <ChevronRight className="size-4 text-muted-foreground" />}
		</Button>
	)
}

export default MenuButton
