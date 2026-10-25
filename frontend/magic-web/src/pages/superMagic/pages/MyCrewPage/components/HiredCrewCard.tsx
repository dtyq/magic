import { memo } from "react"
import {
	CircleArrowUp,
	Ellipsis,
	Eye,
	MessageCircleMore,
	Rocket,
	Settings2,
	Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Separator } from "@/components/shadcn-ui/separator"
import { CardFooterBadge } from "@/pages/superMagic/components/CardFooterBadge"
import { CardFooterLabel } from "@/pages/superMagic/components/CardFooterLabel"
import { cn } from "@/utils/cn"
import type { MyCrewView } from "@/services/crew/CrewService"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { MyCrewCardMainSection } from "./MyCrewCardMainSection"
import {
	isInsideMyCrewCardInteractiveTarget,
	preventMyCrewCardInteractiveClick,
} from "./my-crew-card-interaction"
import {
	formatVersionBadge,
	isOfficialMyCrewAgent,
	resolveMyCrewOriginLabel,
	resolveMyCrewPublisherLabel,
	resolveTeamSharedCrewPermissions,
} from "./my-crew-card-shared"

interface HiredCrewCardProps {
	employee: MyCrewView
	href: string
	onEdit?: (agentCode: string) => void
	onConversation?: (agentCode: string) => void
	onDelete?: (agentCode: string) => void
	onDismiss?: (agentCode: string) => void
	onPublishToStore?: (agentCode: string) => void
	isTeamSharedCard?: boolean
	isCollaboratedCard?: boolean
}

function HiredCrewCard({
	employee,
	href,
	onEdit,
	onConversation,
	onDelete,
	onDismiss,
	onPublishToStore,
	isTeamSharedCard = false,
	isCollaboratedCard = false,
}: HiredCrewCardProps) {
	const removeFromCrew = onDismiss ?? onDelete
	const { t } = useTranslation("crew/market")
	const versionBadgeLabel = formatVersionBadge(employee.latestVersionCode) ?? ""
	const isOfficialAgent = isOfficialMyCrewAgent(employee)
	const originLabel = resolveMyCrewOriginLabel(employee, t)
	const publisherLabel = resolveMyCrewPublisherLabel(
		employee.publisherType,
		employee.publisherName,
		t,
	)
	const footerPoweredByText = publisherLabel
		? t("interface:appList.powerBy", {
				company: publisherLabel,
			})
		: null
	const { canDelete, canEdit, canPublish } = resolveTeamSharedCrewPermissions(employee.userRole)
	const isViewer = isReadOnlyProject(employee.userRole)
	const actionLabel = isViewer ? t("myCrewPage.view") : t("myCrewPage.edit")
	const ActionIcon = isViewer ? Eye : Settings2
	const canOpenCardByRootClick = isCollaboratedCard || !isTeamSharedCard || canEdit
	const canRenderSharedEditorActions = isTeamSharedCard && canEdit && onEdit
	const canRenderSharedMenu =
		isTeamSharedCard &&
		(onConversation != null ||
			(canPublish && onPublishToStore != null) ||
			(canDelete && onDelete != null))
	const trimmedCreatorName = employee.creatorName?.trim() ?? ""
	const teamSharedCreatorLabel =
		isTeamSharedCard && trimmedCreatorName
			? t("myCrewPage.teamSharedCreatedBy", { name: trimmedCreatorName })
			: null

	function handleCardRootClick() {
		if (!canOpenCardByRootClick) return
		onEdit?.(employee.agentCode)
	}

	function renderFooterBadge() {
		if (employee.needUpgrade)
			return (
				<CardFooterBadge
					label={t("myCrewPage.badgeUpdated")}
					icon={<CircleArrowUp className="size-3 shrink-0" aria-hidden />}
					className="gap-1 border-indigo-500 bg-background/90 px-2 py-0.5 text-xs font-normal text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
					labelClassName="text-xs font-normal leading-4"
					dataTestId="my-crew-card-footer-updated-badge"
				/>
			)
		if (!versionBadgeLabel) return null

		return (
			<CardFooterBadge
				label={versionBadgeLabel}
				className="px-2 py-0.5 text-xs font-semibold"
				dataTestId="my-crew-card-footer-version-badge"
			/>
		)
	}

	function renderTeamSharedActions() {
		if (!canRenderSharedEditorActions) {
			return (
				<div className="pointer-events-auto flex w-full flex-col gap-1">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 min-h-8 w-full gap-2 bg-card px-3 text-xs font-medium shadow-xs hover:bg-card"
						onClick={(event) => {
							preventMyCrewCardInteractiveClick(event)
							onConversation?.(employee.agentCode)
						}}
						data-testid="my-crew-card-conversation-button"
					>
						<MessageCircleMore className="size-4 shrink-0" aria-hidden />
						{t("myCrewPage.openConversation")}
					</Button>
				</div>
			)
		}

		return (
			<div className="pointer-events-auto flex w-full gap-1">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 min-h-8 flex-1 gap-2 px-3 text-xs font-medium shadow-xs"
					onClick={(event) => {
						preventMyCrewCardInteractiveClick(event)
						onEdit?.(employee.agentCode)
					}}
					data-testid="my-crew-card-edit-button"
				>
					<ActionIcon className="size-4 shrink-0" aria-hidden />
					{actionLabel}
				</Button>
				{canRenderSharedMenu ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<span>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="size-8 min-h-8 shrink-0 bg-card shadow-xs hover:bg-card"
									onClick={preventMyCrewCardInteractiveClick}
									aria-label={t("myCrewPage.moreActionsAria")}
									data-testid="my-crew-card-more-trigger"
								>
									<Ellipsis className="size-4" aria-hidden />
								</Button>
							</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-44"
							data-testid="my-crew-card-more-menu"
						>
							{onConversation ? (
								<DropdownMenuItem
									onClick={() => onConversation(employee.agentCode)}
									data-testid="my-crew-card-menu-chat"
								>
									<MessageCircleMore className="size-4 shrink-0" aria-hidden />
									{t("myCrewPage.openConversation")}
								</DropdownMenuItem>
							) : null}
							{canPublish && onPublishToStore ? (
								<DropdownMenuItem
									onClick={() => onPublishToStore(employee.agentCode)}
									data-testid="my-crew-card-menu-publish"
								>
									<Rocket className="size-4 shrink-0" aria-hidden />
									{t("myCrewPage.openPublish")}
								</DropdownMenuItem>
							) : null}
							{canDelete && onDelete ? (
								<>
									{onConversation || (canPublish && onPublishToStore) ? (
										<DropdownMenuSeparator />
									) : null}
									<DropdownMenuItem
										variant="destructive"
										onClick={() => onDelete(employee.agentCode)}
										data-testid="my-crew-card-menu-delete"
									>
										<Trash2 className="size-4 shrink-0" aria-hidden />
										{t("myCrewPage.delete")}
									</DropdownMenuItem>
								</>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
		)
	}

	function renderCollaboratedActions() {
		return (
			<div className="pointer-events-auto flex w-full">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 min-h-8 w-full gap-2 px-3 text-xs font-medium shadow-xs"
					onClick={(event) => {
						preventMyCrewCardInteractiveClick(event)
						onEdit?.(employee.agentCode)
					}}
					data-testid="my-crew-card-edit-button"
				>
					<ActionIcon className="size-4 shrink-0" aria-hidden />
					{actionLabel}
				</Button>
			</div>
		)
	}

	return (
		// Keep the avatar offset inside each grid item; Safari can otherwise overlap adjacent rows.
		<div
			className="relative flex min-h-0 min-w-0 flex-col pt-12 text-current"
			data-href={href}
			data-testid="my-crew-card"
			data-my-crew-card-kind={isCollaboratedCard ? "collaborated" : "hired"}
			onClick={(event) => {
				if (isInsideMyCrewCardInteractiveTarget(event.target)) return
				handleCardRootClick()
			}}
		>
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-md border border-border bg-popover shadow-sm">
				<MyCrewCardMainSection
					employee={employee}
					footer={
						<>
							<Separator />
							<div className="flex min-w-0 shrink-0 items-center justify-between gap-2 rounded-b-md bg-sidebar px-4 py-2.5">
								{teamSharedCreatorLabel ? (
									<CardFooterLabel
										label={teamSharedCreatorLabel}
										withTooltip
										dataTestId="my-crew-card-team-shared-creator"
									/>
								) : originLabel ? (
									<CardFooterLabel
										label={originLabel}
										withTooltip
										dataTestId="my-crew-card-origin"
									/>
								) : footerPoweredByText ? (
									<CardFooterLabel label={footerPoweredByText} withTooltip />
								) : (
									<div className="flex-1" aria-hidden />
								)}
								{renderFooterBadge()}
							</div>
						</>
					}
					actions={
						isCollaboratedCard ? (
							renderCollaboratedActions()
						) : isTeamSharedCard ? (
							renderTeamSharedActions()
						) : (
							<div className="pointer-events-auto flex w-full flex-col gap-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 min-h-8 w-full gap-2 bg-card px-3 text-xs font-medium shadow-xs hover:bg-card"
									onClick={(event) => {
										preventMyCrewCardInteractiveClick(event)
										onConversation?.(employee.agentCode)
									}}
									data-testid="my-crew-card-conversation-button"
								>
									<MessageCircleMore className="size-4 shrink-0" aria-hidden />
									{t("myCrewPage.openConversation")}
								</Button>
								{!isOfficialAgent && removeFromCrew ? (
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
											preventMyCrewCardInteractiveClick(event)
											removeFromCrew(employee.agentCode)
										}}
										data-testid="my-crew-card-dismiss-button"
									>
										{t("dismiss")}
									</button>
								) : null}
							</div>
						)
					}
				/>
			</div>
		</div>
	)
}

export default memo(HiredCrewCard)
