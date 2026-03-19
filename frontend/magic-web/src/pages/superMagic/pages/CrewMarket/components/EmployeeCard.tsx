import { memo } from "react"
import { ArrowUpCircle, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { StoreAgentView } from "@/services/crew/CrewService"

interface EmployeeCardProps {
	employee: StoreAgentView
	onHire?: (id: string) => void
	onDismiss?: (id: string) => void
	onUpgrade?: (id: string) => void
	onDetails?: (id: string) => void
}

function EmployeeCard({ employee, onHire, onDismiss, onUpgrade, onDetails }: EmployeeCardProps) {
	const { t } = useTranslation("crew/market")

	return (
		<div
			className="flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-md border border-border bg-popover p-4 shadow-sm"
			data-testid="employee-card"
		>
			{/* Avatar & Info */}
			<div className="flex flex-1 flex-col gap-2">
				<div className="relative size-[50px] shrink-0">
					{employee.icon ? (
						<img
							src={employee.icon}
							alt={employee.name}
							className="size-full rounded-full object-cover"
						/>
					) : (
						<div className="flex size-full items-center justify-center rounded-full bg-foreground text-background">
							<CrewFallbackAvatar />
						</div>
					)}
				</div>
				<p className="text-base font-semibold leading-6 text-foreground">{employee.name}</p>
				<p className="line-clamp-2 text-sm text-muted-foreground">{employee.description}</p>
			</div>

			{/* Feature badges */}
			{employee.playbooks.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{employee.playbooks.map((feature) => (
						<Badge key={feature.name} variant="outline" className="rounded-md text-xs">
							{feature.icon && <span className="mr-1">{feature.icon}</span>}
							{feature.name}
						</Badge>
					))}
				</div>
			)}

			{/* Upgrade notice */}
			{employee.isAdded && employee.needUpgrade && (
				<button
					type="button"
					className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
					onClick={() => onUpgrade?.(employee.id)}
					data-testid="employee-card-upgrade-notice"
				>
					<ArrowUpCircle className="size-3.5 shrink-0" />
					{t("upgradeAvailable")}
				</button>
			)}

			{/* Action buttons */}
			<div className="flex min-w-0 gap-2">
				{employee.isAdded ? (
					<Button
						variant="ghost"
						className="h-9 flex-1 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
						onClick={() => onDismiss?.(employee.id)}
						data-testid="employee-card-dismiss-button"
					>
						{t("dismiss")}
					</Button>
				) : (
					<Button
						variant="default"
						className="h-9 flex-1"
						onClick={() => onHire?.(employee.id)}
						data-testid="employee-card-hire-button"
					>
						{t("hire")}
					</Button>
				)}
				<Button
					variant="outline"
					className="h-9 shrink-0 bg-background"
					onClick={() => onDetails?.(employee.id)}
					data-testid="employee-card-details-button"
				>
					{t("details")}
				</Button>
			</div>

			{/* Hired indicator */}
			{employee.isAdded && !employee.needUpgrade && (
				<div
					className="flex items-center gap-1.5 text-xs text-muted-foreground"
					data-testid="employee-card-hired-indicator"
				>
					<Check className="size-3.5 text-green-500" />
					{t("hired")}
				</div>
			)}
		</div>
	)
}

export default memo(EmployeeCard)
