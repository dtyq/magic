import type { MouseEventHandler } from "react"
import type { LucideIcon } from "lucide-react"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"

interface SelfMediaPostActionButtonProps {
	label: string
	Icon: LucideIcon
	showLabel: boolean
	onClick: MouseEventHandler<HTMLButtonElement>
	dataTestId: string
	variant?: "default" | "primary"
}

export function getSelfMediaPostActionClassName(
	showLabel: boolean,
	variant: "default" | "primary" = "default",
) {
	return cn(
		"inline-flex h-9 shrink-0 items-center justify-center rounded-full text-[12px] font-[700] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
		showLabel ? "gap-1 px-2.5" : "w-9",
		variant === "primary"
			? "bg-[#18181b] text-[#ffffff] hover:bg-[#27272a]"
			: "bg-[#f4f4f5] text-[#18181b] hover:bg-[#e4e4e7]",
	)
}

function SelfMediaPostActionButton({
	label,
	Icon,
	showLabel,
	onClick,
	dataTestId,
	variant = "default",
}: SelfMediaPostActionButtonProps) {
	return (
		<MagicTooltip title={showLabel ? undefined : label}>
			<button
				type="button"
				className={getSelfMediaPostActionClassName(showLabel, variant)}
				aria-label={label}
				onClick={onClick}
				data-testid={dataTestId}
			>
				<Icon className="h-3.5 w-3.5 shrink-0" />
				{showLabel ? <span className="whitespace-nowrap">{label}</span> : null}
			</button>
		</MagicTooltip>
	)
}

export default SelfMediaPostActionButton
