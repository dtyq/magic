import { memo, type MouseEvent } from "react"
import { Ellipsis, MessageCircleMore, Rocket, Settings2, Trash2 } from "lucide-react"
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
import type { MyCrewView } from "@/services/crew/CrewService"
import { MyCrewCardMainSection } from "./MyCrewCardMainSection"
import {
	isInsideMyCrewCardInteractiveTarget,
	preventMyCrewCardInteractiveClick,
} from "./my-crew-card-interaction"
import { formatVersionBadge, resolveMyCrewCreatedFooterBadgeLabel } from "./my-crew-card-shared"

interface CreatedCrewCardProps {
	employee: MyCrewView
	href: string
	onNavigate?: (event: MouseEvent<HTMLElement>) => void
	onEdit?: (agentCode: string) => void
	onConversation?: (agentCode: string) => void
	onUpgrade?: (agentCode: string) => void
	onPublishToStore?: (agentCode: string) => void
	onDelete?: (agentCode: string) => void
}

function CreatedCrewCard({
	employee,
	href,
	onNavigate,
	onEdit,
	onConversation,
	onUpgrade,
	onPublishToStore,
	onDelete,
}: CreatedCrewCardProps) {
	const isDeleteAction = onDelete != null
	const canOpenConversation =
		Boolean(employee.latestPublishedAt?.trim()) && onConversation != null
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")

	const createdStatusBadgeLabel = resolveMyCrewCreatedFooterBadgeLabel(
		employee.sourceType,
		t,
		tCrewCreate,
	)
	const createdFooterBadgeLabel = employee.needUpgrade
		? t("skillsLibrary.upgrade")
		: formatVersionBadge(employee.latestVersionCode) || createdStatusBadgeLabel

	function handleCardRootClick(event: MouseEvent<HTMLDivElement>) {
		if (isInsideMyCrewCardInteractiveTarget(event.target)) return
		onNavigate?.(event)
	}

	return (
		<div
			className="relative flex h-full min-h-0 min-w-0 flex-col text-current"
			data-href={href}
			data-testid="my-crew-card"
			data-my-crew-card-kind="created"
			onClick={handleCardRootClick}
		>
			<div className="relative flex h-full min-h-0 min-w-0 flex-col rounded-md border border-border bg-popover shadow-sm">
				<MyCrewCardMainSection
					employee={employee}
					footer={
						<>
							<Separator />
							<div className="flex min-w-0 shrink-0 items-center justify-between gap-2 rounded-b-md bg-sidebar px-4 py-2.5">
								<CardFooterLabel
									label={t("myCrewPage.crewType.createdByMe")}
									withTooltip
									dataTestId="my-crew-card-footer-created-by"
								/>
								<CardFooterBadge
									label={createdFooterBadgeLabel}
									className="px-2 py-0.5 text-xs font-semibold"
									dataTestId="my-crew-card-footer-badge"
								/>
							</div>
						</>
					}
					actions={
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
								<Settings2 className="size-4 shrink-0" aria-hidden />
								{t("myCrewPage.edit")}
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<span>
										<Button
											type="button"
											variant="outline"
											size="icon"
											className="size-8 min-h-8 shrink-0 shadow-xs"
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
									{canOpenConversation ? (
										<DropdownMenuItem
											onClick={() => onConversation?.(employee.agentCode)}
											data-testid="my-crew-card-menu-chat"
										>
											<MessageCircleMore
												className="size-4 shrink-0"
												aria-hidden
											/>
											{t("myCrewPage.openConversation")}
										</DropdownMenuItem>
									) : null}
									{employee.needUpgrade ? (
										<DropdownMenuItem
											onClick={() => onUpgrade?.(employee.agentCode)}
											data-testid="my-crew-card-menu-upgrade"
										>
											{t("skillsLibrary.upgrade")}
										</DropdownMenuItem>
									) : null}
									{onPublishToStore ? (
										<DropdownMenuItem
											onClick={() => onPublishToStore(employee.agentCode)}
											data-testid="my-crew-card-menu-publish"
										>
											<Rocket className="size-4 shrink-0" aria-hidden />
											{t("myCrewPage.openPublish")}
										</DropdownMenuItem>
									) : null}
									{isDeleteAction ? (
										<>
											{canOpenConversation ||
											employee.needUpgrade ||
											onPublishToStore ? (
												<DropdownMenuSeparator />
											) : null}
											<DropdownMenuItem
												variant="destructive"
												onClick={() => onDelete?.(employee.agentCode)}
												data-testid="my-crew-card-menu-delete"
											>
												<Trash2 className="size-4 shrink-0" aria-hidden />
												{t("myCrewPage.delete")}
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					}
				/>
			</div>
		</div>
	)
}

export default memo(CreatedCrewCard)
