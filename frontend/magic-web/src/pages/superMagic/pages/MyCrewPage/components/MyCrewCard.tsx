import { memo } from "react"
import { ArrowUpCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { MyCrewView } from "@/services/crew/CrewService"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"

interface MyCrewCardProps {
	employee: MyCrewView
	onEdit?: (agentCode: string) => void
	onDismiss?: (agentCode: string) => void
	onUpgrade?: (agentCode: string) => void
}

function MyCrewCard({ employee, onEdit, onDismiss, onUpgrade }: MyCrewCardProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")
	const rawName = employee.name?.trim() || ""
	const displayName = rawName || t("crew/create:untitledCrew")
	const displayRole = employee.role?.trim() || ""
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const avatarUrl = typeof employee.icon === "string" ? employee.icon.trim() : ""
	const featureList = Array.isArray(employee.playbooks) ? employee.playbooks : []

	return (
		<div
			className="flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-md border border-border bg-popover p-4 shadow-sm"
			data-testid="my-crew-card"
		>
			{/* Avatar & Info */}
			<div className="flex flex-1 flex-col gap-2">
				<div className="relative size-[50px] shrink-0">
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt={displayName}
							className="size-full rounded-full object-cover"
						/>
					) : (
						<div className="flex size-full items-center justify-center rounded-full text-foreground">
							<CrewFallbackAvatar />
						</div>
					)}
				</div>
				<p className="text-base font-semibold leading-6 text-foreground">{displayName}</p>
				{displayRole && (
					<p
						className="w-fit rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
						data-testid="my-crew-card-role"
					>
						{displayRole}
					</p>
				)}
				<p className="line-clamp-2 text-sm text-muted-foreground">{displayDescription}</p>
			</div>

			{/* Feature badges */}
			{featureList.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{featureList.map((feature, index) => (
						<Badge
							key={`${feature.name || "feature"}-${index}`}
							variant="outline"
							className="rounded-md text-xs"
						>
							{/* {feature.icon && <LucideLazyIcon icon={feature.icon} size={16} />} */}
							{feature.name || tCrewCreate("playbook.untitled")}
						</Badge>
					))}
				</div>
			)}

			{/* Upgrade notice */}
			{employee.needUpgrade && (
				<button
					type="button"
					className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
					onClick={() => onUpgrade?.(employee.agentCode)}
					data-testid="my-crew-card-upgrade-notice"
				>
					<ArrowUpCircle className="size-3.5 shrink-0" />
					{t("myCrewPage.upgradeAvailable")}
				</button>
			)}

			{/* Action buttons */}
			<div className="flex min-w-0 gap-2">
				<Button
					variant="default"
					className="h-9 flex-1"
					onClick={() => onEdit?.(employee.agentCode)}
					data-testid="my-crew-card-edit-button"
				>
					{t("myCrewPage.edit")}
				</Button>
				<Button
					variant="ghost"
					className="h-9 shrink-0 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
					onClick={() => onDismiss?.(employee.agentCode)}
					data-testid="my-crew-card-dismiss-button"
				>
					{t("dismiss")}
				</Button>
			</div>
		</div>
	)
}

export default memo(MyCrewCard)
