import { memo, useMemo } from "react"
import { ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import { CardFooterBadge } from "@/pages/superMagic/components/CardFooterBadge"
import { CardFooterLabel } from "@/pages/superMagic/components/CardFooterLabel"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { StoreAgentView } from "@/services/crew/CrewService"
import {
	formatVersionBadge,
	isEmployeeMarketPrimaryActionDisabled,
	isOfficialPublisherType,
	resolveEmployeeMarketPrimaryActionLabel,
	resolvePublisherLabel,
} from "./employee-card-shared"

interface EmployeeCardProps {
	employee: StoreAgentView
	onHire?: (id: string) => void
	onDismiss?: (id: string) => void
	onDetails?: (id: string) => void
}

function EmployeeCard({ employee, onHire, onDismiss, onDetails }: EmployeeCardProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")

	const displayName = employee.name?.trim() || tCrewCreate("untitledCrew")
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")

	const publisherLabel = useMemo(
		() => resolvePublisherLabel(employee.publisherType, employee.publisherName, t),
		[employee.publisherName, employee.publisherType, t],
	)
	const publisherText = t("interface:appList.powerBy", {
		company: publisherLabel,
	})
	const isOfficialPublisher = isOfficialPublisherType(employee.publisherType)

	const versionLabel = useMemo(
		() => formatVersionBadge(employee.latestVersionCode) ?? "",
		[employee.latestVersionCode],
	)

	const roleLine = employee.role?.trim() ?? ""
	const avatarSrc = employee.icon ?? ""
	const hasAvatarSrc = Boolean(avatarSrc)
	const primaryActionLabel = resolveEmployeeMarketPrimaryActionLabel(employee, t)

	return (
		<div
			className="relative flex h-full min-h-0 w-full min-w-0 flex-col pt-11"
			data-testid="employee-card"
		>
			<div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md border border-border bg-popover shadow-xs">
				<div className="flex min-h-0 flex-1 flex-col items-center px-4 pb-2.5 pt-16">
					<div className="flex w-full min-w-0 flex-1 flex-col items-center gap-2.5">
						<div className="flex min-h-6 w-full min-w-0 items-center justify-center text-center">
							<p className="w-full truncate text-base font-medium leading-6 text-foreground">
								{displayName}
							</p>
						</div>

						<div className="flex min-h-6 w-full justify-center">
							{roleLine ? (
								<Badge
									variant="outline"
									className="w-fit min-w-0 max-w-full shrink justify-center overflow-hidden rounded-md border border-border bg-background px-2 py-0.5 text-xs font-normal leading-4 text-foreground shadow-none hover:bg-background"
									data-testid="employee-card-role-badge"
								>
									<SmartTooltip
										elementType="span"
										className="inline-block max-w-full text-center align-top text-xs font-normal leading-4"
										content={roleLine}
										sideOffset={4}
									>
										{roleLine}
									</SmartTooltip>
								</Badge>
							) : null}
						</div>

						<div className="flex min-h-10 w-full min-w-0 justify-center">
							<p className="line-clamp-2 w-full text-center text-sm font-normal leading-5 text-muted-foreground">
								{displayDescription}
							</p>
						</div>

						<div
							className="mt-auto flex w-full shrink-0 flex-col gap-1 pt-2"
							data-testid="employee-card-actions"
						>
							<Button
								variant="outline"
								size="sm"
								className="h-8 w-full px-3 text-xs font-medium shadow-xs"
								onClick={() => onDetails?.(employee.id)}
								data-testid="employee-card-details-button"
							>
								{t("details")}
							</Button>
							{employee.allowDelete ? (
								<Button
									variant="destructive"
									size="sm"
									className="h-8 w-full bg-destructive/10 px-3 text-xs font-medium text-destructive shadow-xs hover:bg-destructive/15 hover:text-destructive"
									onClick={() => onDismiss?.(employee.id)}
									disabled={isEmployeeMarketPrimaryActionDisabled(employee)}
									data-testid="employee-card-dismiss-button"
								>
									{primaryActionLabel}
								</Button>
							) : (
								<Button
									variant="default"
									size="sm"
									className="h-8 w-full px-3 text-xs font-medium shadow-xs"
									onClick={() => onHire?.(employee.id)}
									disabled={isEmployeeMarketPrimaryActionDisabled(employee)}
									data-testid="employee-card-hire-button"
								>
									{primaryActionLabel}
								</Button>
							)}
						</div>
					</div>
				</div>

				<Separator className="shrink-0 bg-border" />

				<div className="flex shrink-0 items-center gap-2 bg-sidebar px-4 py-2.5">
					{isOfficialPublisher ? (
						<div
							className="flex min-w-0 flex-1 items-center gap-1"
							data-testid="employee-card-official-publisher"
						>
							<ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate text-xs leading-4 text-muted-foreground">
								{publisherLabel}
							</span>
						</div>
					) : (
						<CardFooterLabel label={publisherText} />
					)}
					{versionLabel ? (
						<CardFooterBadge
							label={versionLabel}
							className="border border-border bg-background px-2 py-0.5 text-xs font-semibold text-foreground shadow-none hover:bg-background"
							data-testid="employee-card-version-badge"
						/>
					) : null}
				</div>
			</div>

			<div
				className={cn(
					"absolute left-1/2 top-0 z-10 -translate-x-1/2",
					"size-24 overflow-hidden rounded-full border-[3px] border-popover bg-popover",
					"shadow-sm",
				)}
			>
				<div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-muted text-foreground">
					{hasAvatarSrc ? (
						<img src={avatarSrc} alt={displayName} className="size-full object-cover" />
					) : (
						<CrewFallbackAvatar />
					)}
				</div>
			</div>
		</div>
	)
}

export default memo(EmployeeCard)
