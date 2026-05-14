import { memo } from "react"
import { Ellipsis, MessageCircle, Settings2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import type { MyCrewView } from "@/services/crew/CrewService"
import type { MyCrewCrewTypeTab } from "../tab-state"
import MyCrewAvatar from "./MyCrewAvatar"
import { resolveMyCrewPresentationSource } from "./my-crew-mobile-shared"
import {
	resolveMyCrewDisableActionDisabled,
	resolveMyCrewDisableActionLabel,
	resolveMyCrewHiredActionKind,
	resolveTeamSharedCrewPermissions,
} from "./my-crew-card-shared"
import { preventMyCrewCardInteractiveClick } from "./my-crew-card-interaction"

interface MyCrewCardMobileProps {
	employee: MyCrewView
	listVariant: MyCrewCrewTypeTab | "all"
	href: string
	onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void
	onCardClick?: (agentCode: string) => void
	onChat?: (agentCode: string) => void
	onEdit?: (agentCode: string) => void
	onMoreClick?: (employee: MyCrewView) => void
	onUpgrade?: (agentCode: string) => void
	onDelete?: (agentCode: string) => void
	onDismiss?: (agentCode: string) => void
	onDisable?: (agentCode: string) => void
}

/** 共享/市场来源在聚合列表里必须可见，因此保留轻量角标以避免来源语义丢失。 */
function SourceBadge(props: { source: "teamShared" | "market" }) {
	const { source } = props
	const { t } = useTranslation("crew/market")
	const label =
		source === "teamShared"
			? t("myCrewPage.detailSheet.source.team")
			: t("myCrewPage.detailSheet.source.market")
	const className =
		source === "teamShared"
			? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
			: "border-indigo-500/20 bg-indigo-500/10 text-indigo-500"

	return (
		<span
			className={`inline-flex h-5 max-w-[72px] items-center rounded-full border px-2 text-[10px] font-medium leading-none ${className}`}
			data-testid={`my-crew-card-mobile-source-${source}`}
			title={label}
		>
			<span className="block truncate">{label}</span>
		</span>
	)
}

/** 卡片只保留一个稳定的聊天主 CTA，避免详情/编辑链路和主操作竞争注意力。 */
function MyCrewCardMobile({
	employee,
	listVariant,
	href,
	onNavigate,
	onCardClick,
	onChat,
	onEdit,
	onMoreClick,
	onUpgrade,
	onDelete,
	onDismiss,
	onDisable,
}: MyCrewCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")
	const displayName = employee.name?.trim() || tCrewCreate("untitledCrew")
	const displayRole = employee.role?.trim() || ""
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const normalizedListVariant = listVariant === "all" ? undefined : listVariant
	const presentationSource = resolveMyCrewPresentationSource(employee, normalizedListVariant)
	const isCreatedList = listVariant === "created"
	const isHiredList = listVariant === "hired"
	const isTeamSharedList = listVariant === "team-shared"
	const hiredActionKind = resolveMyCrewHiredActionKind(employee.sourceType)
	const removeFromCrew = employee.allowDelete ? (onDelete ?? onDismiss) : undefined
	const disableActionLabel = resolveMyCrewDisableActionLabel(
		employee.allowDelete,
		employee.publisherType,
		t,
	)
	const isDisableActionDisabled = resolveMyCrewDisableActionDisabled(
		employee.allowDelete,
		employee.enabled,
	)
	const { canDelete, canEdit, canPublish } = resolveTeamSharedCrewPermissions(employee.userRole)
	const canNavigateByCardClick = !isTeamSharedList || canEdit
	const canShowMoreActions = isCreatedList || (isTeamSharedList && (canPublish || canDelete))
	const editButtonLabel = isTeamSharedList && !canEdit ? t("details") : t("myCrewPage.edit")

	/** 根点击沿用语义化 anchor，但只读协作者不能从卡片根部误入编辑链路。 */
	function handleCardNavigate(event: React.MouseEvent<HTMLAnchorElement>) {
		event.preventDefault()

		if (!canNavigateByCardClick) {
			return
		}

		onNavigate?.(event)
		onCardClick?.(employee.agentCode)
	}

	/** 聊天 CTA 保持为显式按钮，并阻止冒泡以避免误触卡片根点击。 */
	function handleChatClick(event: React.MouseEvent<HTMLButtonElement>) {
		preventMyCrewCardInteractiveClick(event)
		onChat?.(employee.agentCode)
	}

	return (
		<a
			href={href}
			onClick={handleCardNavigate}
			className="relative flex h-full min-h-0 w-full min-w-0 flex-col pt-8 text-current no-underline"
			data-testid="my-crew-card-mobile"
		>
			<div className="relative flex h-full min-h-0 flex-col rounded-2xl bg-card px-3 pb-3 pt-10 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.08)] transition-opacity active:opacity-70">
				<MyCrewAvatar
					employee={employee}
					sizeClassName="h-16 w-16"
					fallbackTextClassName="text-[18px] font-semibold text-white"
					className="absolute left-1/2 top-0 z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-background shadow-[0px_8px_24px_0px_rgba(0,0,0,0.20)]"
					testId="my-crew-card-mobile-avatar-wrap"
				/>

				{presentationSource !== "custom" ? (
					<div className="absolute left-3 top-3">
						<SourceBadge source={presentationSource} />
					</div>
				) : null}

				{employee.needUpgrade ? (
					<Badge
						variant="outline"
						className="absolute right-3 top-3 rounded-full border-primary/20 bg-primary/10 px-2 py-0 text-[10px] font-medium leading-4 text-primary"
						data-testid="my-crew-card-mobile-upgrade-badge"
					>
						{t("myCrewPage.badgeUpdated")}
					</Badge>
				) : null}

				<div className="flex min-h-0 flex-1 flex-col items-center gap-2">
					<p className="w-full truncate text-center text-[15px] font-semibold leading-tight text-foreground">
						{displayName}
					</p>

					{displayRole ? (
						<Badge
							variant="outline"
							className="max-w-full justify-center overflow-hidden rounded-md px-2 py-0.5 text-xs font-normal"
							data-testid="my-crew-card-mobile-role"
						>
							<span className="block truncate">{displayRole}</span>
						</Badge>
					) : null}

					<p className="h-[36px] overflow-hidden px-1 text-center text-[12px] leading-[1.5] text-muted-foreground [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
						{displayDescription}
					</p>

					{employee.needUpgrade && !isHiredList ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 min-h-8 w-full text-xs font-medium"
							data-testid="my-crew-card-mobile-upgrade-button"
							onClick={(event) => {
								preventMyCrewCardInteractiveClick(event)
								onUpgrade?.(employee.agentCode)
							}}
						>
							{t("myCrewPage.upgradeAvailable")}
						</Button>
					) : null}

					{isHiredList ? (
						<div className="flex w-full flex-col gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 min-h-8 w-full px-3 text-xs font-medium shadow-xs"
								onClick={(event) => {
									preventMyCrewCardInteractiveClick(event)
									onEdit?.(employee.agentCode)
								}}
								data-testid="my-crew-card-mobile-details-button"
							>
								{t("details")}
							</Button>
							{hiredActionKind === "dismiss" && removeFromCrew ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 min-h-8 w-full border-destructive/20 text-xs font-medium text-destructive shadow-xs"
									onClick={(event) => {
										preventMyCrewCardInteractiveClick(event)
										removeFromCrew(employee.agentCode)
									}}
									data-testid="my-crew-card-mobile-dismiss-button"
								>
									{t("dismiss")}
								</Button>
							) : null}
							{hiredActionKind === "disable" ? (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="h-8 min-h-8 w-full px-3 text-xs font-medium shadow-xs"
									onClick={(event) => {
										preventMyCrewCardInteractiveClick(event)
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
						<div className="flex w-full gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 min-h-8 flex-1 gap-2 px-3 text-xs font-medium shadow-xs"
								onClick={(event) => {
									preventMyCrewCardInteractiveClick(event)
									onEdit?.(employee.agentCode)
								}}
								data-testid="my-crew-card-mobile-edit-button"
							>
								<Settings2 className="h-4 w-4 shrink-0" aria-hidden />
								{editButtonLabel}
							</Button>

							{canShowMoreActions ? (
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="size-8 min-h-8 shrink-0 shadow-xs"
									onClick={(event) => {
										preventMyCrewCardInteractiveClick(event)
										onMoreClick?.(employee)
									}}
									aria-label={t("myCrewPage.moreActionsAria")}
									data-testid="my-crew-card-mobile-more-trigger"
								>
									<Ellipsis className="h-4 w-4" aria-hidden />
								</Button>
							) : null}
						</div>
					)}

					<Button
						type="button"
						variant="outline"
						className="mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-xl"
						data-testid="my-crew-card-mobile-chat-button"
						onClick={handleChatClick}
					>
						<MessageCircle className="h-4 w-4 text-foreground" aria-hidden />
						<span className="text-[13px] font-medium leading-none text-foreground">
							{t("myCrewPage.openConversation")}
						</span>
					</Button>
				</div>
			</div>
		</a>
	)
}

export default memo(MyCrewCardMobile)
