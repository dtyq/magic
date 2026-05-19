import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type MouseEvent,
} from "react"
import { Building2, MessageCircle, ShieldCheck, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { StoreAgentView } from "@/services/crew/CrewService"
import { cn } from "@/lib/utils"
import {
	isEmployeeMarketPrimaryActionDisabled,
	isOfficialPublisherType,
	resolvePublisherLabel,
} from "./employee-card-shared"

interface EmployeeCardMobileProps {
	employee: StoreAgentView
	onHire?: (id: string) => void
	onDetails?: (id: string) => void
	onOpenMarketDetail?: (id: string) => void
}

const CARD_BG = "var(--color-card)"
const FADE_W = 20

function CapChip({ name, themeColor }: { name: string; themeColor: string | null }) {
	const color = themeColor ?? "#6366f1"
	return (
		<span
			className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none"
			style={{ color, backgroundColor: `${color}1a` }}
		>
			{name}
		</span>
	)
}

function CapabilitiesRow({ playbooks }: { playbooks: StoreAgentView["playbooks"] }) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [showLeft, setShowLeft] = useState(false)
	const [showRight, setShowRight] = useState(false)

	const updateMasks = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		setShowLeft(el.scrollLeft > 2)
		setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
	}, [])

	useLayoutEffect(() => {
		updateMasks()
	}, [updateMasks, playbooks.length])

	useEffect(() => {
		const el = scrollRef.current
		if (!el) return
		const ro = new ResizeObserver(updateMasks)
		ro.observe(el)
		return () => ro.disconnect()
	}, [updateMasks])

	return (
		<div className="relative -mx-4">
			<div
				ref={scrollRef}
				onScroll={updateMasks}
				// overscroll-x-contain 阻止水平滚动冒泡到父级页面，防止 iOS Safari 意外触发页面后退
				className="no-scrollbar flex w-full touch-pan-x flex-row gap-1.5 overflow-x-auto overflow-y-visible overscroll-x-contain px-4 [-webkit-overflow-scrolling:touch]"
			>
				{playbooks.map((p, i) => (
					<CapChip key={`${p.name}-${i}`} name={p.name} themeColor={p.themeColor} />
				))}
			</div>
			<div
				className="pointer-events-none absolute inset-y-0 left-0 z-[1] transition-opacity duration-200"
				style={{
					width: FADE_W,
					background: `linear-gradient(to right, ${CARD_BG} 0%, transparent 100%)`,
					opacity: showLeft ? 1 : 0,
				}}
			/>
			<div
				className="pointer-events-none absolute inset-y-0 right-0 z-[1] transition-opacity duration-200"
				style={{
					width: FADE_W,
					background: `linear-gradient(to left, ${CARD_BG} 0%, transparent 100%)`,
					opacity: showRight ? 1 : 0,
				}}
			/>
		</div>
	)
}

function EmployeeCardMobile({
	employee,
	onHire,
	onDetails,
	onOpenMarketDetail,
}: EmployeeCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")

	const displayName = employee.name?.trim() || tCrewCreate("untitledCrew")
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const roleLine = employee.role?.trim() ?? ""
	const avatarSrc = employee.icon ?? ""
	const isOfficial = isOfficialPublisherType(employee.publisherType)
	const publisherLabel = resolvePublisherLabel(employee.publisherType, employee.publisherName, t)

	// Mobile card keeps a single action: added agents enter chat; only not-added agents can hire.
	const actionIsChat = employee.isAdded
	const actionLabel = actionIsChat ? t("chat") : t("hire")
	const actionDisabled = actionIsChat ? false : isEmployeeMarketPrimaryActionDisabled(employee)

	function handleInfoClick() {
		// Prototype: info area always opens the detail sheet regardless of hired state.
		// Chat navigation is handled by the detail dialog's "Start Chat" button.
		onOpenMarketDetail?.(employee.id)
	}

	function handleActionClick(e: MouseEvent<HTMLButtonElement>) {
		e.stopPropagation()
		if (!employee.isAdded) {
			onHire?.(employee.id)
		} else {
			onDetails?.(employee.id)
		}
	}

	return (
		<div
			className="flex flex-col gap-3 rounded-2xl bg-card p-4"
			style={{ boxShadow: "0px 2px 12px 0px rgba(0,0,0,0.07)" }}
			data-testid="employee-card-mobile"
		>
			{/* Info area — click opens detail or chat */}
			<button
				type="button"
				onClick={handleInfoClick}
				className="flex flex-col gap-3 text-left transition-opacity active:opacity-75"
				data-testid="employee-card-mobile-info-area"
			>
				{/* Avatar + name/role/publisher row */}
				<div className="flex w-full items-start gap-3">
					<div
						className="size-12 shrink-0 overflow-hidden rounded-full border-2 border-background"
						style={{ boxShadow: "0px 4px 12px 0px rgba(0,0,0,0.12)" }}
						data-testid="employee-card-mobile-avatar-wrap"
					>
						{avatarSrc ? (
							<img
								src={avatarSrc}
								alt={displayName}
								className="size-full object-cover"
							/>
						) : (
							<div className="flex size-full items-center justify-center rounded-full bg-muted text-foreground">
								<CrewFallbackAvatar />
							</div>
						)}
					</div>

					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<div className="flex min-w-0 items-center gap-2">
							<p
								className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-tight text-foreground"
								data-testid="employee-card-mobile-name"
							>
								{displayName}
							</p>
							{roleLine ? (
								<span
									className="ml-auto inline-flex h-[18px] max-w-[45%] shrink-0 items-center overflow-hidden rounded-full border border-primary/30 px-1.5 text-[10px] font-medium leading-none text-muted-foreground/80"
									data-testid="employee-card-mobile-role-badge"
								>
									<span className="truncate">{roleLine}</span>
								</span>
							) : null}
						</div>

						<div className="flex min-w-0 items-center gap-1 text-muted-foreground">
							{isOfficial ? (
								<ShieldCheck className="size-3 shrink-0" strokeWidth={2} />
							) : (
								<Building2 className="size-3 shrink-0" strokeWidth={2} />
							)}
							<p
								className="truncate text-[12px] leading-4"
								data-testid="employee-card-mobile-publisher"
							>
								{publisherLabel}
							</p>
						</div>
					</div>
				</div>

				{/* Description */}
				<p
					className="line-clamp-2 text-[13px] leading-[1.55] text-muted-foreground"
					data-testid="employee-card-mobile-description"
				>
					{displayDescription}
				</p>
			</button>

			{/* Capabilities chip row — only when playbooks exist */}
			{employee.playbooks.length > 0 ? (
				<CapabilitiesRow playbooks={employee.playbooks} />
			) : null}

			{/* Action button */}
			<button
				type="button"
				onClick={handleActionClick}
				disabled={actionDisabled}
				className={cn(
					"inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold leading-none transition-opacity active:opacity-75 disabled:cursor-not-allowed disabled:opacity-50",
					actionIsChat
						? "border border-border bg-card text-primary"
						: "bg-primary text-primary-foreground",
				)}
				data-testid={
					actionIsChat
						? "employee-card-mobile-details-button"
						: "employee-card-mobile-hire-button"
				}
			>
				{actionIsChat ? (
					<MessageCircle className="size-4 shrink-0" aria-hidden />
				) : (
					<UserPlus className="size-4 shrink-0" aria-hidden />
				)}
				<span className="truncate">{actionLabel}</span>
			</button>
		</div>
	)
}

export default memo(EmployeeCardMobile)
