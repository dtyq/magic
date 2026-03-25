import { memo } from "react"
import { CircleArrowUp, MessageCircleMore } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { CardFooterBadge } from "@/pages/superMagic/components/CardFooterBadge"
import { CardFooterLabel } from "@/pages/superMagic/components/CardFooterLabel"
import { cn } from "@/lib/utils"
import type { MyCrewView } from "@/services/crew/CrewService"
import { MyCrewCardMainSection } from "./MyCrewCardMainSection"
import {
	isInsideMyCrewCardInteractiveTarget,
	preventMyCrewCardInteractiveClick,
} from "./my-crew-card-interaction"
import {
	formatVersionBadge,
	resolveMyCrewDisableActionDisabled,
	resolveMyCrewDisableActionLabel,
	resolveMyCrewHiredActionKind,
	resolveMyCrewPublisherLabel,
} from "./my-crew-card-shared"

interface HiredCrewCardProps {
	employee: MyCrewView
	href: string
	onEdit?: (agentCode: string) => void
	onConversation?: (agentCode: string) => void
	onDelete?: (agentCode: string) => void
	onDismiss?: (agentCode: string) => void
	onDisable?: (agentCode: string) => void
}

function HiredCrewCard({
	employee,
	href,
	onEdit,
	onConversation,
	onDelete,
	onDismiss,
	onDisable,
}: HiredCrewCardProps) {
	const removeFromCrew = employee.allowDelete ? (onDelete ?? onDismiss) : undefined
	const { t } = useTranslation("crew/market")
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

	function handleCardRootClick() {
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

	return (
		<div
			className="relative flex h-full min-h-0 min-w-0 flex-col text-current"
			data-href={href}
			data-testid="my-crew-card"
			data-my-crew-card-kind="hired"
			onClick={(event) => {
				if (isInsideMyCrewCardInteractiveTarget(event.target)) return
				handleCardRootClick()
			}}
		>
			<div className="relative flex h-full min-h-0 min-w-0 flex-col rounded-md border border-border bg-popover shadow-sm">
				<MyCrewCardMainSection
					employee={employee}
					footer={
						<>
							<Separator />
							<div className="flex min-w-0 shrink-0 items-center justify-between gap-2 rounded-b-md bg-sidebar px-4 py-2.5">
								<CardFooterLabel label={footerPoweredByText} withTooltip />
								{renderFooterBadge()}
							</div>
						</>
					}
					actions={
						<div className="pointer-events-auto flex w-full flex-col gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 min-h-8 w-full gap-2 px-3 text-xs font-medium shadow-xs"
								onClick={(event) => {
									preventMyCrewCardInteractiveClick(event)
									onConversation?.(employee.agentCode)
								}}
								data-testid="my-crew-card-conversation-button"
							>
								<MessageCircleMore className="size-4 shrink-0" aria-hidden />
								{t("myCrewPage.openConversation")}
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
										preventMyCrewCardInteractiveClick(event)
										removeFromCrew(employee.agentCode)
									}}
									data-testid="my-crew-card-dismiss-button"
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
										preventMyCrewCardInteractiveClick(event)
										onDisable?.(employee.agentCode)
									}}
									disabled={isDisableActionDisabled}
									data-testid="my-crew-card-disable-button"
								>
									{disableActionLabel}
								</Button>
							) : null}
						</div>
					}
				/>
			</div>
		</div>
	)
}

export default memo(HiredCrewCard)
