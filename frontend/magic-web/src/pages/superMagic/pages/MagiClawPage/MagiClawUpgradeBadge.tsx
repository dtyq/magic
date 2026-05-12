import { CircleArrowUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/lib/utils"

interface MagiClawUpgradeBadgeProps {
	className?: string
	"data-testid"?: string
	onClick?: () => void
	disabled?: boolean
}

export function shouldShowMagiClawUpgradeBadge(needUpgrade?: boolean | null) {
	return Boolean(needUpgrade)
}

const upgradeBadgeClassName =
	"h-6 shrink-0 gap-1 rounded-md border-transparent bg-indigo-50 px-2 py-0 text-xs font-normal text-indigo-500 shadow-none"

export function MagiClawUpgradeBadge({
	className,
	"data-testid": dataTestId,
	onClick,
	disabled = false,
}: MagiClawUpgradeBadgeProps) {
	const { t } = useTranslation("sidebar")
	const label = t("superLobster.created.upgradeAvailable")

	const interactiveClassName = cn(
		upgradeBadgeClassName,
		"inline-flex items-center",
		onClick && !disabled && "cursor-pointer hover:bg-indigo-100/80",
		onClick && disabled && "cursor-not-allowed opacity-60",
		className,
	)

	if (onClick) {
		return (
			<button
				type="button"
				className={interactiveClassName}
				data-testid={dataTestId}
				disabled={disabled}
				onClick={onClick}
			>
				<CircleArrowUp className="size-3 shrink-0" aria-hidden />
				<span>{label}</span>
			</button>
		)
	}

	return (
		<Badge className={cn(upgradeBadgeClassName, className)} data-testid={dataTestId}>
			<CircleArrowUp className="size-3" aria-hidden />
			{label}
		</Badge>
	)
}
