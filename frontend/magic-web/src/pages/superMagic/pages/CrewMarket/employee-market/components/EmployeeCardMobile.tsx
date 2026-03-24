import { memo, useMemo } from "react"
import { ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import { CardFooterBadge } from "@/pages/superMagic/components/CardFooterBadge"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { StoreAgentView } from "@/services/crew/CrewService"
import {
	formatPublisherHandle,
	formatVersionBadge,
	isEmployeeMarketPrimaryActionDisabled,
	isOfficialPublisherType,
	resolveEmployeeMarketPrimaryActionLabel,
	resolvePublisherLabel,
} from "./employee-card-shared"

interface EmployeeCardMobileProps {
	employee: StoreAgentView
	onHire?: (id: string) => void
	onDismiss?: (id: string) => void
	onDetails?: (id: string) => void
}

function EmployeeCardMobile({ employee, onHire, onDismiss, onDetails }: EmployeeCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")

	const displayName = employee.name?.trim() || tCrewCreate("untitledCrew")
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")

	const publisherLabel = useMemo(
		() => resolvePublisherLabel(employee.publisherType, employee.publisherName, t),
		[employee.publisherName, employee.publisherType, t],
	)

	const versionLabel = useMemo(
		() => formatVersionBadge(employee.latestVersionCode) ?? "",
		[employee.latestVersionCode],
	)
	const isOfficialPublisher = isOfficialPublisherType(employee.publisherType)

	const roleLine = employee.role?.trim() ?? ""
	const avatarSrc = employee.icon ?? ""
	const hasAvatarSrc = Boolean(avatarSrc)
	const primaryActionLabel = resolveEmployeeMarketPrimaryActionLabel(employee, t)

	return (
		<div
			className="relative flex h-full min-h-0 w-full min-w-0 flex-col pt-9"
			data-testid="employee-card-mobile"
		>
			<div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md border border-border bg-popover shadow-xs">
				<div className="flex min-h-0 flex-1 flex-col items-center px-2 pb-2 pt-11">
					<div className="flex w-full min-w-0 flex-1 flex-col items-center gap-1.5">
						<p className="w-full truncate text-center text-sm font-semibold leading-5 text-foreground">
							{displayName}
						</p>

						{roleLine ? (
							<Badge
								variant="outline"
								className="max-w-full justify-center overflow-hidden rounded-md px-1.5 py-0 text-[10px] font-normal leading-4"
								data-testid="employee-card-mobile-role-badge"
							>
								<span className="block min-w-0 truncate">{roleLine}</span>
							</Badge>
						) : null}

						<p className="line-clamp-3 w-full text-center text-[11px] font-normal leading-4 text-muted-foreground">
							{displayDescription}
						</p>

						<div
							className="mt-auto flex w-full shrink-0 flex-col gap-1 pt-1.5"
							data-testid="employee-card-mobile-actions"
						>
							<Button
								variant="outline"
								size="sm"
								className="h-7 min-h-7 w-full px-1.5 text-[10px] font-medium shadow-xs"
								onClick={() => onDetails?.(employee.id)}
								data-testid="employee-card-mobile-details-button"
							>
								{t("details")}
							</Button>
							{employee.allowDelete ? (
								<Button
									variant="destructive"
									size="sm"
									className="h-7 min-h-7 w-full bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive hover:bg-destructive/15 hover:text-destructive"
									onClick={() => onDismiss?.(employee.id)}
									disabled={isEmployeeMarketPrimaryActionDisabled(employee)}
									data-testid="employee-card-mobile-dismiss-button"
								>
									{primaryActionLabel}
								</Button>
							) : (
								<Button
									variant="default"
									size="sm"
									className="h-7 min-h-7 w-full px-1.5 text-[10px] font-medium"
									onClick={() => onHire?.(employee.id)}
									disabled={isEmployeeMarketPrimaryActionDisabled(employee)}
									data-testid="employee-card-mobile-hire-button"
								>
									{primaryActionLabel}
								</Button>
							)}
						</div>
					</div>
				</div>

				<Separator className="shrink-0 bg-border" />

				<div className="flex shrink-0 items-center gap-1 bg-sidebar p-2">
					<div className="flex min-w-0 flex-1 items-center gap-1">
						{isOfficialPublisher ? (
							<>
								<ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
								<span
									className="min-w-0 truncate text-xs leading-4 text-muted-foreground"
									data-testid="employee-card-mobile-official-publisher"
								>
									{publisherLabel}
								</span>
							</>
						) : (
							<span className="min-w-0 truncate text-xs leading-4 text-muted-foreground">
								{formatPublisherHandle(publisherLabel)}
							</span>
						)}
					</div>
					{versionLabel ? (
						<CardFooterBadge
							label={versionLabel}
							className="px-2 py-0.5 text-xs font-semibold"
							data-testid="employee-card-mobile-version-badge"
						/>
					) : null}
				</div>
			</div>

			<div
				className={cn(
					"absolute left-1/2 top-0 z-10 -translate-x-1/2",
					"size-16 overflow-hidden rounded-full border-2 border-popover bg-popover shadow-sm",
				)}
				data-testid="employee-card-mobile-avatar-wrap"
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

export default memo(EmployeeCardMobile)
