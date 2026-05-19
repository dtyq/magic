import { Building2, CalendarDays, MessageCircle, RefreshCw, User, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { useTimezone } from "@/providers/TimezoneProvider/hooks"
import type { MyCrewView } from "@/services/crew/CrewService"
import { normalizeLocale } from "@/utils/locale"
import { resolvePublisherLabel } from "@/pages/superMagic/pages/CrewMarket/employee-market/components/employee-card-shared"
import MyCrewAvatar from "./MyCrewAvatar"
import { resolveMyCrewPresentationSource } from "./my-crew-mobile-shared"
import type { MyCrewCrewTypeTab } from "../tab-state"
import type { MyCrewPresentationSource } from "./my-crew-mobile-shared"

/**
 * 提炼出详情 sheet 的最小字段集，使市场 Agent（StoreAgentView）与我的成员（MyCrewView）
 * 都能直接传入，不需要额外映射。可选字段在对应来源分支不可达时安全降级。
 */
export interface CrewDetailSheetEmployee {
	agentCode: string
	name: string | null
	role: string | null
	description: string | null
	icon: string | null
	playbooks: { name: string; themeColor?: string | null }[]
	publisherName?: string | null
	updatedAt: string
	/** 最新发布时间；缺失时由 updatedAt 兜底（StoreAgentView 暂无此字段）。 */
	latestPublishedAt?: string | null
	/** 创建者名称；仅 teamShared 来源展示，StoreAgentView 不含此字段不影响市场分支。 */
	creatorName?: string | null
	/** 发布方类型枚举；用于 resolvePublisherLabel 将原始枚举值映射为可读名称。 */
	publisherType?: string | null
}

/** 自定义 footer 操作按钮描述。 */
export interface CrewDetailSheetAction {
	label: string
	onClick: () => void
	/** 操作图标，显示在文字左侧。 */
	icon?: React.ReactNode
	testId?: string
}

interface MyCrewDetailSheetProps {
	employee: CrewDetailSheetEmployee | null
	listVariant?: MyCrewCrewTypeTab | "all" | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onChat: (agentCode: string) => void
	/**
	 * 强制指定展示来源，绕过 resolveMyCrewPresentationSource 的自动推断。
	 * 来自 Crew 市场的调用方应传入 "market"，来自我的成员的调用方可省略由内部计算。
	 */
	presentationSource?: MyCrewPresentationSource
	/**
	 * 自定义主操作按钮（如"雇佣"、"开始聊天"）。
	 * 传入时替换默认的固定"开始聊天"按钮；不传时维持原有默认行为。
	 * 当调用方同时传入了 presentationSource（即接管了 footer 控制权），
	 * 不传 primaryAction 等同于"无操作"——footer 整体隐藏，与桌面端对齐。
	 */
	primaryAction?: CrewDetailSheetAction
	/**
	 * 可选的次要操作按钮（如"解雇"），显示在主操作左侧，宽度收缩。
	 * 仅在同时存在 primaryAction 时才有意义。
	 */
	secondaryAction?: CrewDetailSheetAction
}

/** 信息区标题统一封装，避免详情页分段样式在多个模块重复漂移。 */
function SectionLabel({ children }: { children: React.ReactNode }) {
	return <p className="px-[14px] text-[14px] leading-5 text-muted-foreground">{children}</p>
}

/** 来源 badge 由共享来源类型映射颜色，保证列表与详情的来源语义一致。 */
function SourceBadge(props: { source: "teamShared" | "market" | "custom"; label: string }) {
	const { source, label } = props
	const className =
		source === "market"
			? "bg-indigo-500/10 text-indigo-500"
			: source === "teamShared"
				? "bg-emerald-500/10 text-emerald-600"
				: "bg-amber-500/10 text-amber-600"

	return (
		<span
			className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium leading-none ${className}`}
		>
			{label}
		</span>
	)
}

/** 详情元信息行集中复用一套布局，避免日期/来源字段的左右对齐规则分散。 */
function InfoRow(props: { icon: React.ReactNode; label: string; value: string; isLast?: boolean }) {
	const { icon, label, value, isLast = false } = props

	return (
		<>
			<div className="flex h-12 items-center gap-3 px-[14px]">
				<span className="shrink-0 text-muted-foreground">{icon}</span>
				<span className="shrink-0 text-[15px] leading-5 text-muted-foreground">
					{label}
				</span>
				<span className="flex-1 truncate text-right text-[15px] leading-5 text-foreground">
					{value}
				</span>
			</div>
			{!isLast ? <div className="h-px w-full bg-border" /> : null}
		</>
	)
}

/** 使用用户偏好时区格式化日期，避免移动端详情出现与全局时区策略不一致的时间展示。 */
function formatMyCrewDate(
	value: string | null | undefined,
	language: string,
	timezone: string,
	fallback: string,
) {
	const normalizedValue = value?.trim()
	if (!normalizedValue) return fallback

	const parsed = new Date(normalizedValue)
	if (Number.isNaN(parsed.getTime())) return fallback

	try {
		return new Intl.DateTimeFormat(normalizeLocale(language).replace("_", "-"), {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: timezone,
		}).format(parsed)
	} catch {
		return fallback
	}
}

/** 详情页根据来源类型拼出信息区，避免页面容器里混入大量来源分支 JSX。 */
function MyCrewInfoSection(props: {
	employee: CrewDetailSheetEmployee
	source: "teamShared" | "market" | "custom"
	language: string
	timezone: string
}) {
	const { employee, source, language, timezone } = props
	const { t } = useTranslation("crew/market")
	const fallbackValue = "—"
	const updatedAtText = formatMyCrewDate(employee.updatedAt, language, timezone, fallbackValue)
	const createdAtText = formatMyCrewDate(
		employee.latestPublishedAt || employee.updatedAt,
		language,
		timezone,
		fallbackValue,
	)

	if (source === "market") {
		const publisherDisplayName = resolvePublisherLabel(
			employee.publisherType ?? "",
			employee.publisherName,
			t,
		)
		return (
			<>
				<InfoRow
					icon={<Building2 className="h-4 w-4" />}
					label={t("myCrewPage.detailSheet.info.publisher")}
					value={publisherDisplayName}
				/>
				<InfoRow
					icon={<RefreshCw className="h-4 w-4" />}
					label={t("myCrewPage.detailSheet.info.updatedAt")}
					value={updatedAtText}
				/>
				<InfoRow
					icon={<CalendarDays className="h-4 w-4" />}
					label={t("myCrewPage.detailSheet.info.addedAt")}
					value={createdAtText}
					isLast
				/>
			</>
		)
	}

	if (source === "teamShared") {
		return (
			<>
				<InfoRow
					icon={<Building2 className="h-4 w-4" />}
					label={t("myCrewPage.detailSheet.info.sharedBy")}
					value={employee.creatorName?.trim() || fallbackValue}
				/>
				<InfoRow
					icon={<RefreshCw className="h-4 w-4" />}
					label={t("myCrewPage.detailSheet.info.updatedAt")}
					value={updatedAtText}
				/>
				<InfoRow
					icon={<CalendarDays className="h-4 w-4" />}
					label={t("myCrewPage.detailSheet.info.addedAt")}
					value={createdAtText}
					isLast
				/>
			</>
		)
	}

	return (
		<>
			<InfoRow
				icon={<User className="h-4 w-4" />}
				label={t("myCrewPage.detailSheet.info.createdBy")}
				value={t("myCrewPage.detailSheet.info.you")}
			/>
			<InfoRow
				icon={<RefreshCw className="h-4 w-4" />}
				label={t("myCrewPage.detailSheet.info.updatedAt")}
				value={updatedAtText}
			/>
			<InfoRow
				icon={<CalendarDays className="h-4 w-4" />}
				label={t("myCrewPage.detailSheet.info.createdAt")}
				value={createdAtText}
				isLast
			/>
		</>
	)
}

/** `MyCrew` 详情 sheet 用原型的底部抽屉结构承接现有列表数据，先替换旧桌面弹窗语义。 */
export default function MyCrewDetailSheet({
	employee,
	listVariant,
	open,
	onOpenChange,
	onChat,
	presentationSource: presentationSourceProp,
	primaryAction,
	secondaryAction,
}: MyCrewDetailSheetProps) {
	const { t, i18n } = useTranslation("crew/market")
	const { timezone } = useTimezone()
	const scrollRef = useRef<HTMLDivElement | null>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(false)
	const lastEmployeeRef = useRef<CrewDetailSheetEmployee | null>(null)
	const displayEmployee = employee ?? lastEmployeeRef.current!

	if (employee) {
		lastEmployeeRef.current = employee
	}

	const presentationSource = useMemo(
		() =>
			// 调用方显式指定来源时（如 Crew 市场）直接使用，跳过内部字段推断
			presentationSourceProp ??
			(displayEmployee
				? resolveMyCrewPresentationSource(
						displayEmployee as Pick<MyCrewView, "sourceType" | "creatorName">,
						listVariant,
					)
				: "custom"),
		[displayEmployee, listVariant, presentationSourceProp],
	)

	const sourceLabel = useMemo(() => {
		if (!displayEmployee) return ""
		if (presentationSource === "market") {
			return t("myCrewPage.detailSheet.source.market")
		}
		if (presentationSource === "teamShared") {
			return t("myCrewPage.detailSheet.source.team")
		}
		return t("myCrewPage.detailSheet.source.custom")
	}, [displayEmployee, presentationSource, t])

	// 滚动渐变遮罩用于维持原型里详情抽屉的层次反馈，但不改变内容布局。
	const updateMasks = useCallback(() => {
		const element = scrollRef.current
		if (!element) return
		setShowTopMask(element.scrollTop > 4)
		setShowBottomMask(element.scrollTop + element.clientHeight < element.scrollHeight - 4)
	}, [])

	// 每次打开详情都重置滚动位置，避免上一个员工的滚动状态泄漏到当前抽屉。
	useEffect(() => {
		if (!open) return
		if (scrollRef.current) {
			scrollRef.current.scrollTop = 0
		}
		const frame = requestAnimationFrame(updateMasks)
		return () => cancelAnimationFrame(frame)
	}, [open, updateMasks, displayEmployee?.agentCode])

	// 详情主 CTA 继续承接既有聊天跳转能力，保持视觉更新但不改业务链路。
	function handleChat() {
		if (!displayEmployee) return
		onChat(displayEmployee.agentCode)
		onOpenChange(false)
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex h-[calc(100dvh-max(44px,var(--safe-area-inset-top)))] flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="my-crew-detail-sheet"
			>
				<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
					<div className="h-1 w-20 rounded-full bg-muted-foreground" aria-hidden />
				</div>

				<div className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="absolute left-[10px] top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("myCrewPage.detailSheet.closeAria")}
						data-testid="my-crew-detail-sheet-close"
					>
						<X className="h-[22px] w-[22px] text-foreground" />
					</button>
					<SheetTitle className="max-w-[247px] truncate text-center font-poppins text-[18px] font-medium leading-6 text-foreground">
						{t("myCrewPage.detailSheet.title")}
					</SheetTitle>
				</div>

				<div className="relative min-h-0 flex-1">
					<div
						ref={scrollRef}
						className="no-scrollbar absolute inset-0 flex flex-col gap-2.5 overflow-y-auto px-[10px] pb-4 pt-2"
						onScroll={updateMasks}
					>
						{displayEmployee ? (
							<>
								<div className="relative flex flex-col items-center gap-3 px-4 py-6">
									<div className="absolute right-3 top-3">
										<SourceBadge
											source={presentationSource}
											label={sourceLabel}
										/>
									</div>

									<MyCrewAvatar
										employee={displayEmployee}
										sizeClassName="h-20 w-20"
										fallbackTextClassName="text-[26px] font-semibold text-white"
										className="h-20 w-20 overflow-hidden rounded-full border-[3px] border-background"
										style={{ boxShadow: "0px 8px 24px 0px rgba(0,0,0,0.20)" }}
										testId="my-crew-detail-sheet-avatar"
									/>

									<div className="flex flex-col items-center gap-2">
										<p

											className="line-clamp-2 text-center text-[20px] font-bold leading-tight text-foreground"
											data-testid="my-crew-detail-sheet-title"
										>
											{displayEmployee.name?.trim() ||
												t("detailDialog.emptyName")}
										</p>
										{displayEmployee.role?.trim() ? (
											<span className="inline-flex h-5 max-w-[80%] items-center overflow-hidden rounded-full bg-primary/10 px-2 text-[11px] font-medium leading-none text-primary">
												<span className="truncate">{displayEmployee.role.trim()}</span>
											</span>
										) : null}
									</div>
								</div>

								<div className="flex flex-col gap-2">
									<SectionLabel>{t("myCrewPage.detailSheet.about")}</SectionLabel>
									<div className="rounded-lg bg-card px-[14px] py-3">
										<p className="text-[15px] leading-[1.6] text-foreground">
											{displayEmployee.description?.trim() ||
												t("interface:appList.noDescription")}
										</p>
									</div>
								</div>

								{displayEmployee.playbooks.length > 0 ? (
									<div className="flex flex-col gap-2">
										<SectionLabel>
											{t("myCrewPage.detailSheet.capabilities")}
										</SectionLabel>
										<div className="rounded-lg bg-card px-[14px] py-3">
											<div className="flex flex-wrap gap-2">
												{displayEmployee.playbooks.map((playbook, i) => {
													// 优先使用服务端下发的主题色，降级至 indigo (#6366f1)，与 EmployeeCardMobile CapChip 保持一致
													const chipColor = playbook.themeColor ?? "#6366f1"
													return (
														<span
															key={`${playbook.name}-${i}`}
															className="inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium leading-none"
															style={{ color: chipColor, backgroundColor: `${chipColor}1a` }}
														>
															{playbook.name}
														</span>
													)
												})}
											</div>
										</div>
									</div>
								) : null}

								<div className="flex flex-col gap-2">
									<SectionLabel>
										{t("myCrewPage.detailSheet.info.label")}
									</SectionLabel>
									<div className="overflow-hidden rounded-lg bg-card">
										<MyCrewInfoSection
											employee={displayEmployee}
											source={presentationSource}
											language={i18n.language}
											timezone={timezone}
										/>
									</div>
								</div>
							</>
						) : null}
					</div>

					<div
						className="pointer-events-none absolute inset-x-0 top-0 h-8 transition-opacity duration-200"
						style={{
							background:
								"linear-gradient(to bottom, var(--color-muted) 0%, transparent 100%)",
							opacity: showTopMask ? 1 : 0,
						}}
					/>
					<div
						className="pointer-events-none absolute inset-x-0 bottom-0 h-12 transition-opacity duration-200"
						style={{
							background:
								"linear-gradient(to top, var(--color-muted) 0%, transparent 100%)",
							opacity: showBottomMask ? 1 : 0,
						}}
					/>
				</div>

				<div
					className="shrink-0 px-[10px] pt-2"
					style={{ paddingBottom: "max(var(--safe-area-inset-bottom), 16px)" }}
				>
					{primaryAction ? (
						// 调用方提供自定义操作（如"雇佣"、"开始聊天"），支持次要按钮（如"解雇"）并排
						// key 绑定 testId：状态切换（如已雇→未雇）时强制重挂载，避免 iOS Safari 按钮文字残留
						<div key={primaryAction.testId ?? primaryAction.label} className="flex gap-2">
							{secondaryAction ? (
								<button
									type="button"
									onClick={secondaryAction.onClick}
									className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-destructive/10 px-5 text-[15px] font-semibold text-destructive transition-opacity active:opacity-80"
									data-testid={secondaryAction.testId}
								>
									{secondaryAction.icon}
									{secondaryAction.label}
								</button>
							) : null}
							<button
								type="button"
								onClick={primaryAction.onClick}
								className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary transition-opacity active:opacity-80"
								data-testid={primaryAction.testId}
							>
								{primaryAction.icon}
								<span className="truncate text-[16px] font-semibold text-white">
									{primaryAction.label}
								</span>
							</button>
						</div>
					) : presentationSourceProp ? (
						// 调用方接管了 footer 控制权（即传入了 presentationSource），但未提供
						// primaryAction，说明当前状态无可用操作（如 OFFICIAL_BUILTIN 未雇用）。
						// 与桌面端 canShowEmployeeMarketDetailPrimaryAction=false 的行为对齐：不渲染任何按钮。
						null
					) : (
						// 默认行为：开始聊天，兼容原有的 My Crew 详情入口
						<button
							type="button"
							onClick={handleChat}
							className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary transition-opacity active:opacity-80"
							data-testid="my-crew-detail-sheet-chat-button"
						>
							<MessageCircle className="h-5 w-5 text-white" />
							<span className="truncate text-[16px] font-semibold text-white">
								{t("myCrewPage.detailSheet.startChat")}
							</span>
						</button>
					)}
				</div>
			</SheetContent>
		</Sheet>
	)
}
