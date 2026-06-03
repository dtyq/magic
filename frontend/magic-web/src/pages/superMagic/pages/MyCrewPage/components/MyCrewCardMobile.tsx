import { memo } from "react"
import { MessageCircle, MessageCircleOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MyCrewView } from "@/services/crew/CrewService"
import MyCrewAvatar from "./MyCrewAvatar"
import { isUnpublishedCreatedCrew } from "./my-crew-card-shared"

interface MyCrewCardMobileProps {
	employee: MyCrewView
	onCardClick?: (agentCode: string) => void
	onChat?: (agentCode: string) => void
}

/** Reserved height for the optional role pill so paired grid cards stay aligned. */
const MY_CREW_CARD_ROLE_SLOT_CLASS = "flex h-5 w-full items-center justify-center"

/** Two-line description slot (12px × 1.5 line-height × 2 lines). */
const MY_CREW_CARD_DESCRIPTION_CLASS =
	"mb-3 line-clamp-2 min-h-[2.25rem] overflow-hidden px-1 text-center text-[12px] leading-[1.5] text-muted-foreground"

/**
 * Simplified mobile crew card: avatar + name + role + description + Chat CTA.
 * Grid row equal height: only the outer wrapper uses h-full; inner body uses flex-1
 * (avoids nested h-full collapse on iOS WebKit). Fixed min-heights keep role/description slots even.
 */
function MyCrewCardMobile({ employee, onCardClick, onChat }: MyCrewCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")
	const displayName = employee.name?.trim() || tCrewCreate("untitledCrew")
	const displayRole = employee.role?.trim() || ""
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const isUnpublished = isUnpublishedCreatedCrew(employee)

	function handleCardClick() {
		onCardClick?.(employee.agentCode)
	}

	function handleChatClick(event: React.MouseEvent<HTMLButtonElement>) {
		event.stopPropagation()
		if (isUnpublished) return
		onChat?.(employee.agentCode)
	}

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleCardClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") handleCardClick()
			}}
			className="relative flex h-full w-full min-w-0 cursor-pointer flex-col pt-8"
			data-testid="my-crew-card-mobile"
		>
			<div className="relative flex flex-1 flex-col rounded-2xl bg-card px-3 pb-3 pt-10 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.08)] transition-opacity active:opacity-70">
				{/* Avatar breaks out above the card via absolute positioning */}
				<MyCrewAvatar
					employee={employee}
					sizeClassName="h-16 w-16"
					fallbackTextClassName="text-[18px] font-semibold text-white"
					className="absolute left-1/2 top-0 z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-background shadow-[0px_8px_24px_0px_rgba(0,0,0,0.20)]"
					testId="my-crew-card-mobile-avatar-wrap"
				/>

				{/* Name + role badge (role slot keeps row height when role is empty) */}
				<div className="mb-2 flex w-full flex-col items-center gap-1.5">
					<p className="w-full truncate text-center text-[15px] font-semibold leading-tight text-foreground">
						{displayName}
					</p>

					<div className={MY_CREW_CARD_ROLE_SLOT_CLASS}>
						{displayRole ? (
							<span
								className="inline-flex h-5 max-w-full items-center overflow-hidden rounded-full bg-primary/10 px-2 text-[11px] font-medium leading-none text-primary"
								data-testid="my-crew-card-mobile-role"
							>
								<span className="truncate">{displayRole}</span>
							</span>
						) : null}
					</div>
				</div>

				<p className={MY_CREW_CARD_DESCRIPTION_CLASS}>{displayDescription}</p>

				{/* Chat CTA pinned to bottom */}
				<button
					type="button"
					className={
						isUnpublished
							? "active:not-disabled:opacity-60 mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-muted text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
							: "mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border transition-opacity active:opacity-60"
					}
					data-testid="my-crew-card-mobile-chat-button"
					onClick={handleChatClick}
					disabled={isUnpublished}
				>
					{isUnpublished ? (
						<MessageCircleOff className="h-4 w-4 text-muted-foreground" aria-hidden />
					) : (
						<MessageCircle className="h-4 w-4 text-primary" aria-hidden />
					)}
					<span
						className={
							isUnpublished
								? "text-[13px] font-medium leading-none text-muted-foreground"
								: "text-[13px] font-medium leading-none text-primary"
						}
					>
						{isUnpublished
							? t("myCrewPage.detailSheet.unpublishedAction")
							: t("myCrewPage.openConversation")}
					</span>
				</button>
			</div>
		</div>
	)
}

export default memo(MyCrewCardMobile)
