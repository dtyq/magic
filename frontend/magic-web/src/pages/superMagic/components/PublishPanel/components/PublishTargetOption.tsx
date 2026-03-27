import { Children } from "react"
import type { ComponentType, ReactNode } from "react"
import { Building2, CircleUserRound, UsersRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import { getInternalTargetUiKey } from "../publishCopy"
import type { PublishInternalTarget } from "../types"

interface PublishTargetOptionProps {
	target: PublishInternalTarget
	selected: boolean
	onToggle: (target: PublishInternalTarget) => void
	disabled?: boolean
	children?: ReactNode
}

const targetIconMap = {
	PRIVATE: CircleUserRound,
	MEMBER: UsersRound,
	ORGANIZATION: Building2,
} satisfies Record<PublishInternalTarget, ComponentType<{ className?: string }>>

export default function PublishTargetOption({
	target,
	selected,
	onToggle,
	disabled = false,
	children,
}: PublishTargetOptionProps) {
	const { t } = useTranslation("crew/market")
	const Icon = targetIconMap[target]
	const hasExpandedContent = Children.toArray(children).length > 0 && selected
	const targetUiKey = getInternalTargetUiKey(target)

	return (
		<div
			role="button"
			tabIndex={disabled ? -1 : 0}
			onClick={() => {
				if (disabled) return
				onToggle(target)
			}}
			onKeyDown={(event) => {
				if (disabled) return
				if (event.key !== "Enter" && event.key !== " ") return
				event.preventDefault()
				onToggle(target)
			}}
			className={cn(
				"flex w-full items-start gap-1 overflow-hidden rounded-md border bg-card p-3 text-left outline-none transition-colors",
				selected ? "border-foreground" : "border-border",
				disabled && "cursor-not-allowed opacity-50",
			)}
			data-testid={`skill-publish-target-${targetUiKey}`}
			aria-pressed={selected}
			aria-disabled={disabled}
		>
			<div
				className={cn(
					"flex min-w-0 flex-1 flex-col gap-1",
					hasExpandedContent && "gap-2.5",
				)}
			>
				<div className="flex items-center gap-1.5 text-sm text-foreground">
					<Icon className="size-4 shrink-0" />
					<span>{t(`skillEditPage.publishPanel.targets.${targetUiKey}.label`)}</span>
				</div>
				<p className="text-xs leading-4 text-muted-foreground">
					{t(`skillEditPage.publishPanel.targets.${targetUiKey}.description`)}
				</p>
				{hasExpandedContent ? (
					<>
						<Separator className="mt-1" />
						<div
							onClick={(event) => event.stopPropagation()}
							onKeyDown={(event) => event.stopPropagation()}
						>
							{children}
						</div>
					</>
				) : null}
			</div>
			<div className="flex shrink-0 items-start pt-0.5">
				<Checkbox
					checked={selected}
					className={cn(
						"pointer-events-none shadow-xs",
						selected && "[&_svg]:size-3 [&_svg]:stroke-[2.5]",
					)}
					tabIndex={-1}
					aria-hidden="true"
					data-testid={`skill-publish-target-${targetUiKey}-checkbox`}
				/>
			</div>
		</div>
	)
}
