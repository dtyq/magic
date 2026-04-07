import { memo, useEffect, useState } from "react"
import { ArrowUpCircle, CircleArrowUp, Ellipsis, Settings2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import { CardFooterBadge } from "@/pages/superMagic/components/CardFooterBadge"
import { CardFooterLabel } from "@/pages/superMagic/components/CardFooterLabel"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { MyCrewView } from "@/services/crew/CrewService"
import type { MyCrewCrewTypeTab } from "./MyCrewCrewTypeTabs"
import {
	formatVersionBadge,
	resolveMyCrewDisableActionDisabled,
	resolveMyCrewDisableActionLabel,
	resolveMyCrewCreatedFooterBadgeLabel,
	resolveMyCrewHiredActionKind,
	resolveMyCrewPublisherLabel,
} from "./my-crew-card-shared"

interface MyCrewCardMobileBaseProps {
	employee: MyCrewView
	listVariant: MyCrewCrewTypeTab
	href: string
	onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void
	onEdit?: (agentCode: string) => void
	onMoreClick?: (employee: MyCrewView) => void
	onUpgrade?: (agentCode: string) => void
	onDelete?: (agentCode: string) => void
	onDismiss?: (agentCode: string) => void
	onDisable?: (agentCode: string) => void
}
type MyCrewCardMobileProps = MyCrewCardMobileBaseProps

function MyCrewCardMobile({
	employee,
	listVariant,
	href,
	onNavigate,
	onEdit,
	onMoreClick,
	onUpgrade,
	onDelete,
	onDismiss,
	onDisable,
}: MyCrewCardMobileProps) {
	const removeFromCrew = employee.allowDelete ? (onDelete ?? onDismiss) : undefined
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")
	const rawName = employee.name?.trim() || ""
	const displayName = rawName || tCrewCreate("untitledCrew")
	const displayRole = employee.role?.trim() || ""
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const avatarUrl = typeof employee.icon === "string" ? employee.icon.trim() : ""
	const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
	const showRemoteAvatar = Boolean(avatarUrl) && !avatarLoadFailed

	const isHiredList = listVariant === "hired"
	const hiredActionKind = resolveMyCrewHiredActionKind(employee.sourceType)
	const disableActionLabel = resolveMyCrewDisableActionLabel(employee.allowDelete, t)
	const isDisableActionDisabled = resolveMyCrewDisableActionDisabled(
		employee.allowDelete,
		employee.enabled,
	)
	const versionBadgeLabel = formatVersionBadge(employee.latestVersionCode) ?? ""
	const publisherLabel =
		resolveMyCrewPublisherLabel(employee.publisherType, employee.publisherName, t) ||
		t("myCrewPage.footerPoweredByBrand")
	const footerPoweredByText = t("interface:appList.powerBy", {
		company: publisherLabel,
	})
	const createdFooterBadgeLabel = employee.needUpgrade
		? t("skillsLibrary.upgrade")
		: resolveMyCrewCreatedFooterBadgeLabel(employee.sourceType, t, tCrewCreate)

	useEffect(() => {
		setAvatarLoadFailed(false)
	}, [avatarUrl])

	function preventCardNavigation(event: React.MouseEvent<HTMLElement>) {
		event.preventDefault()
		event.stopPropagation()
	}

	function renderFooterBadge() {
		if (isHiredList) {
			if (employee.needUpgrade)
				return (
					<CardFooterBadge
						label={t("myCrewPage.badgeUpdated")}
						icon={<CircleArrowUp className="size-3 shrink-0" aria-hidden />}
						className="gap-1 border-indigo-500 bg-background/90 px-2 py-0.5 text-xs font-normal text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
						labelClassName="text-xs font-normal leading-4"
						data-testid="my-crew-card-mobile-footer-updated-badge"
					/>
				)
			if (!versionBadgeLabel) return null

			return (
				<CardFooterBadge
					label={versionBadgeLabel}
					className="px-2 py-0.5 text-xs font-semibold"
					data-testid="my-crew-card-mobile-footer-version-badge"
				/>
			)
		}

		return (
			<CardFooterBadge
				label={createdFooterBadgeLabel}
				className="px-2 py-0.5 text-xs font-semibold"
				labelClassName="text-xs font-semibold leading-4"
				data-testid="my-crew-card-mobile-footer-badge"
			/>
		)
	}

	return (
		<a
			href={href}
			onClick={onNavigate}
			className="relative flex h-full min-h-0 w-full min-w-0 flex-col pt-8 text-current no-underline"
			data-testid="my-crew-card-mobile"
		>
			<div className="relative flex min-h-0 w-full flex-1 flex-col overflow-visible rounded-md border border-border bg-popover shadow-xs">
				<div
					className={cn(
						"pointer-events-none absolute left-1/2 top-0 z-10 size-16 -translate-x-1/2 -translate-y-1/2",
						"overflow-hidden rounded-full border-[3px] border-popover bg-muted shadow-sm",
					)}
					data-testid="my-crew-card-mobile-avatar-wrap"
				>
					{showRemoteAvatar ? (
						<img
							src={avatarUrl}
							alt=""
							className="size-full object-cover"
							loading="lazy"
							decoding="async"
							onError={() => setAvatarLoadFailed(true)}
						/>
					) : (
						<div className="flex size-full items-center justify-center bg-muted text-foreground">
							<CrewFallbackAvatar />
						</div>
					)}
				</div>

				<div className="flex min-h-0 flex-1 flex-col items-center px-2 pb-2.5 pt-10">
					<SmartTooltip
						elementType="div"
						className="w-full text-center text-sm font-semibold leading-6 text-foreground"
						content={displayName}
						sideOffset={4}
					>
						{displayName}
					</SmartTooltip>

					{displayRole ? (
						<Badge
							variant="outline"
							className="mt-2 max-w-full justify-center overflow-hidden rounded-md px-2 py-0.5 text-xs font-normal"
							data-testid="my-crew-card-mobile-role"
						>
							<SmartTooltip
								elementType="span"
								className="block min-w-0 max-w-full text-xs font-normal leading-4"
								content={displayRole}
								sideOffset={4}
							>
								{displayRole}
							</SmartTooltip>
						</Badge>
					) : null}

					<SmartTooltip
						elementType="div"
						className="mt-2 w-full text-center text-xs leading-4 text-muted-foreground"
						content={displayDescription}
						maxLines={3}
						sideOffset={4}
					>
						{displayDescription}
					</SmartTooltip>

					<div className="mt-auto flex w-full flex-col gap-2 pt-2">
						{!isHiredList && employee.needUpgrade ? (
							<button
								type="button"
								className={cn(
									"pointer-events-auto flex w-full cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1.5",
									"text-xs text-amber-700 transition-colors hover:bg-amber-100/80",
									"bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50",
								)}
								onClick={(event) => {
									preventCardNavigation(event)
									onUpgrade?.(employee.agentCode)
								}}
								data-testid="my-crew-card-mobile-upgrade-notice"
							>
								<ArrowUpCircle className="size-3.5 shrink-0" aria-hidden />
								{t("myCrewPage.upgradeAvailable")}
							</button>
						) : null}

						{isHiredList ? (
							<div className="pointer-events-auto flex w-full flex-col gap-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 min-h-8 w-full px-3 text-xs font-medium shadow-xs"
									onClick={(event) => {
										preventCardNavigation(event)
										onEdit?.(employee.agentCode)
									}}
									data-testid="my-crew-card-mobile-details-button"
								>
									{t("details")}
								</Button>
								{hiredActionKind === "dismiss" && removeFromCrew ? (
									<button
										type="button"
										className={cn(
											"flex h-8 w-full items-center justify-center rounded-md px-3 py-2 shadow-xs",
											"text-xs font-medium leading-4 transition-opacity",
											"hover:opacity-90",
										)}
										style={{
											color: "rgb(239 68 68)",
											backgroundImage:
												"linear-gradient(0deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95)), linear-gradient(0deg, rgb(239, 68, 68), rgb(239, 68, 68))",
										}}
										onClick={(event) => {
											preventCardNavigation(event)
											removeFromCrew(employee.agentCode)
										}}
										data-testid="my-crew-card-mobile-dismiss-button"
									>
										{t("dismiss")}
									</button>
								) : null}
								{hiredActionKind === "disable" ? (
									<Button
										type="button"
										variant="secondary"
										size="sm"
										className="h-8 min-h-8 w-full px-3 text-xs font-medium shadow-xs"
										onClick={(event) => {
											preventCardNavigation(event)
											onDisable?.(employee.agentCode)
										}}
										disabled={isDisableActionDisabled}
										data-testid="my-crew-card-mobile-disable-button"
									>
										{disableActionLabel}
									</Button>
								) : null}
							</div>
						) : (
							<div className="pointer-events-auto flex w-full gap-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 min-h-8 flex-1 gap-2 px-3 text-xs font-medium shadow-xs"
									onClick={(event) => {
										preventCardNavigation(event)
										onEdit?.(employee.agentCode)
									}}
									data-testid="my-crew-card-mobile-edit-button"
								>
									<Settings2 className="size-4 shrink-0" aria-hidden />
									{t("myCrewPage.edit")}
								</Button>

								<Button
									type="button"
									variant="outline"
									size="icon"
									className="size-8 min-h-8 shrink-0 shadow-xs"
									onClick={(event) => {
										preventCardNavigation(event)
										onMoreClick?.(employee)
									}}
									aria-label={t("myCrewPage.moreActionsAria")}
									data-testid="my-crew-card-mobile-more-trigger"
								>
									<Ellipsis className="size-4" aria-hidden />
								</Button>
							</div>
						)}
					</div>
				</div>

				<Separator className="shrink-0 bg-border" />

				<div
					className={cn(
						"pointer-events-none flex min-w-0 shrink-0 items-center gap-1 bg-sidebar px-2 py-2",
						isHiredList ? "flex-nowrap gap-2" : "flex-wrap",
					)}
				>
					<div
						className={cn(
							"flex min-w-0 flex-1 items-center",
							isHiredList
								? "gap-0.5 text-xs leading-4"
								: "flex-wrap gap-x-1 gap-y-0.5 text-[10px] leading-snug",
						)}
					>
						<CardFooterLabel
							label={
								isHiredList
									? footerPoweredByText
									: t("myCrewPage.crewType.createdByMe")
							}
							className={cn(
								isHiredList ? "text-xs leading-4" : "text-[10px] leading-snug",
							)}
							truncate={isHiredList}
							withTooltip
							dataTestId={
								isHiredList
									? "my-crew-card-mobile-footer-powered-by"
									: "my-crew-card-mobile-footer-created-by"
							}
						/>
					</div>
					{renderFooterBadge()}
				</div>
			</div>
		</a>
	)
}

export default memo(MyCrewCardMobile)
