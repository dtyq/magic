import { memo, useCallback, useMemo, type MouseEvent } from "react"
import { Award, MessageCircleMore, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { CardFooterLabel } from "@/pages/superMagic/components/CardFooterLabel"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { StoreAgentView } from "@/services/crew/CrewService"
import {
	formatVersionBadge,
	isEmployeeMarketPrimaryActionDisabled,
	isOfficialBuiltinPublisherType,
	isOfficialPublisherType,
	resolveEmployeeMarketPrimaryActionLabel,
	resolvePublisherLabel,
} from "./employee-card-shared"

interface EmployeeCardProps {
	employee: StoreAgentView
	onHire?: (id: string) => void
	onDismiss?: (id: string) => void
	onDetails?: (id: string) => void
	/** Card click: opens detail dialog only (not chat navigation). */
	onOpenMarketDetail?: (id: string) => void
}

function EmployeeCard({
	employee,
	onHire,
	onDismiss,
	onDetails,
	onOpenMarketDetail,
}: EmployeeCardProps) {
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
	const hidePrimaryAction = isOfficialBuiltinPublisherType(employee.publisherType)

	const versionLabel = useMemo(
		() => formatVersionBadge(employee.latestVersionCode) ?? "",
		[employee.latestVersionCode],
	)

	const roleLine = employee.role?.trim() ?? ""
	const avatarSrc = employee.icon ?? ""
	const hasAvatarSrc = Boolean(avatarSrc)
	const primaryActionLabel = resolveEmployeeMarketPrimaryActionLabel(employee, t)
	const detailsButtonLabel = employee.isAdded ? t("myCrewPage.openConversation") : t("details")

	const handleCardClick = useCallback(() => {
		onOpenMarketDetail?.(employee.id)
	}, [employee.id, onOpenMarketDetail])

	const stopCardClick = useCallback((e: MouseEvent) => {
		e.stopPropagation()
	}, [])

	return (
		<div
			className={cn(
				"group relative flex h-full min-h-0 w-full min-w-0 flex-col pt-10",
				onOpenMarketDetail ? "cursor-pointer" : undefined,
			)}
			data-testid="employee-card"
			onClick={onOpenMarketDetail ? handleCardClick : undefined}
		>
			<div className="absolute inset-x-0 bottom-0 top-10 -z-10 rounded-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:group-hover:shadow-[0_12px_40px_rgba(255,255,255,0.06)]" />
			<div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/60">
				<div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-5 pt-12">
					{employee.isFeatured ? (
						<Badge
							variant="outline"
							className="absolute right-4 top-4 z-20 size-6 rounded-lg border-transparent bg-orange-500/10 p-1 text-orange-600 transition-colors hover:bg-orange-500/20 dark:text-orange-400"
							aria-label={t("skillsLibrary.featured")}
							title={t("skillsLibrary.featured")}
							data-testid="employee-card-featured-badge"
						>
							<Award className="size-4" />
						</Badge>
					) : null}

					<div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3">
						<div className="flex w-full flex-col items-center gap-1.5">
							<p className="w-full truncate text-center text-lg font-semibold tracking-tight text-foreground transition-colors duration-300">
								{displayName}
							</p>
							{roleLine ? (
								<div
									className="inline-flex min-w-0 max-w-full items-center rounded-lg border border-border/50 bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
									data-testid="employee-card-role-badge"
								>
									<SmartTooltip
										elementType="span"
										className="min-w-0 max-w-full truncate text-xs leading-4"
										content={roleLine}
										sideOffset={4}
									>
										{roleLine}
									</SmartTooltip>
								</div>
							) : (
								<div className="h-5" /> /* Placeholder to maintain height */
							)}
						</div>

						<div className="flex w-full min-w-0 flex-1 justify-center py-1">
							<SmartTooltip
								elementType="div"
								maxLines={3}
								className="w-full text-center text-[13px] leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-foreground/90"
								content={displayDescription}
								sideOffset={4}
							>
								{displayDescription}
							</SmartTooltip>
						</div>

						<div
							className="mt-4 flex w-full shrink-0 flex-col gap-2"
							data-testid="employee-card-actions"
						>
							{employee.allowDelete ? (
								<div className="flex w-full min-w-0 gap-2">
									<Button
										variant="outline"
										size="sm"
										className={cn(
											"h-9 rounded-lg border-border/70 px-3 text-xs font-medium shadow-sm transition-all duration-300 hover:border-primary hover:text-primary hover:shadow-md active:scale-[0.98]",
											hidePrimaryAction ? "w-full" : "flex-1",
										)}
										onClick={(e) => {
											stopCardClick(e)
											onDetails?.(employee.id)
										}}
										data-testid="employee-card-details-button"
									>
										{employee.isAdded ? (
											<MessageCircleMore
												className="size-4 shrink-0"
												aria-hidden
											/>
										) : null}
										{detailsButtonLabel}
									</Button>
									{hidePrimaryAction ? null : (
										<Button
											variant="destructive"
											size="sm"
											className="h-9 min-w-0 flex-1 overflow-hidden rounded-lg bg-destructive/10 px-3 text-xs font-medium text-destructive shadow-sm transition-all duration-300 hover:bg-destructive/20 hover:shadow-md active:scale-[0.98]"
											onClick={(e) => {
												stopCardClick(e)
												onDismiss?.(employee.id)
											}}
											disabled={isEmployeeMarketPrimaryActionDisabled(
												employee,
											)}
											data-testid="employee-card-dismiss-button"
										>
											<SmartTooltip
												elementType="span"
												className="block w-full min-w-0 truncate text-xs font-medium text-inherit"
												content={primaryActionLabel}
												sideOffset={4}
											>
												{primaryActionLabel}
											</SmartTooltip>
										</Button>
									)}
								</div>
							) : (
								<div className="flex w-full min-w-0 gap-2">
									<Button
										variant="outline"
										size="sm"
										className={cn(
											"h-9 rounded-lg border-border/70 bg-background px-3 text-xs font-medium shadow-sm transition-all duration-300 hover:border-primary hover:text-primary hover:shadow-md active:scale-[0.98]",
											hidePrimaryAction ? "w-full" : "flex-1",
											employee.isAdded ? "gap-1.5" : undefined,
										)}
										onClick={(e) => {
											stopCardClick(e)
											onDetails?.(employee.id)
										}}
										data-testid="employee-card-details-button"
									>
										{employee.isAdded ? (
											<MessageCircleMore
												className="size-4 shrink-0"
												aria-hidden
											/>
										) : null}
										{detailsButtonLabel}
									</Button>
									{hidePrimaryAction ? null : (
										<Button
											variant="default"
											size="sm"
											className="h-9 min-w-0 flex-1 overflow-hidden rounded-lg px-3 text-xs font-medium shadow-sm transition-all duration-300 hover:shadow-md active:scale-[0.98]"
											onClick={(e) => {
												stopCardClick(e)
												onHire?.(employee.id)
											}}
											disabled={isEmployeeMarketPrimaryActionDisabled(
												employee,
											)}
											data-testid="employee-card-hire-button"
										>
											<SmartTooltip
												elementType="span"
												className="block w-full min-w-0 truncate text-xs font-medium text-inherit"
												content={primaryActionLabel}
												sideOffset={4}
											>
												{primaryActionLabel}
											</SmartTooltip>
										</Button>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-muted/20 px-5 py-3 transition-colors duration-300 group-hover:border-primary/20 group-hover:bg-muted/40">
					{isOfficialPublisher ? (
						<div
							className="flex min-w-0 flex-1 items-center gap-1.5"
							data-testid="employee-card-official-publisher"
						>
							<ShieldCheck className="size-[14px] shrink-0 text-primary" />
							<span className="truncate text-xs font-medium text-muted-foreground">
								{publisherLabel}
							</span>
						</div>
					) : (
						<CardFooterLabel
							label={publisherText}
							className="truncate text-xs font-medium text-muted-foreground"
						/>
					)}
					{versionLabel ? (
						<span
							className="shrink-0 rounded-md border border-border/40 bg-background/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground shadow-sm"
							data-testid="employee-card-version-badge"
						>
							{versionLabel}
						</span>
					) : null}
				</div>
			</div>

			<div
				className={cn(
					"absolute left-1/2 top-0 z-20 -translate-x-1/2",
					"size-20 overflow-hidden rounded-full border-[4px] border-background bg-card",
					"shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/10 group-hover:shadow-md",
				)}
			>
				<div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-muted text-foreground">
					{hasAvatarSrc ? (
						<img
							src={avatarSrc}
							alt={displayName}
							className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
						/>
					) : (
						<CrewFallbackAvatar />
					)}
				</div>
			</div>
		</div>
	)
}

export default memo(EmployeeCard)
