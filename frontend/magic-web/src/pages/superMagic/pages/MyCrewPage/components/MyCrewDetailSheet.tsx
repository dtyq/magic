import { Building2, CalendarDays, MessageCircle, RefreshCw, User, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { useTimezone } from "@/providers/TimezoneProvider/hooks"
import type { MyCrewView } from "@/services/crew/CrewService"
import { normalizeLocale } from "@/utils/locale"
import MyCrewAvatar from "./MyCrewAvatar"
import { resolveMyCrewPresentationSource } from "./my-crew-mobile-shared"
import type { MyCrewCrewTypeTab } from "../tab-state"

interface MyCrewDetailSheetProps {
	employee: MyCrewView | null
	listVariant?: MyCrewCrewTypeTab | "all" | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onChat: (agentCode: string) => void
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
	employee: MyCrewView
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
		return (
			<>
				<InfoRow
					icon={<Building2 className="h-4 w-4" />}
					label={t("myCrewPage.detailSheet.info.publisher")}
					value={employee.publisherName?.trim() || fallbackValue}
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
					value={employee.creatorName.trim()}
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
}: MyCrewDetailSheetProps) {
	const { t, i18n } = useTranslation("crew/market")
	const { timezone } = useTimezone()
	const scrollRef = useRef<HTMLDivElement | null>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(false)
	const lastEmployeeRef = useRef<MyCrewView | null>(null)
	const displayEmployee = employee ?? lastEmployeeRef.current

	if (employee) {
		lastEmployeeRef.current = employee
	}

	const presentationSource = useMemo(
		() =>
			displayEmployee
				? resolveMyCrewPresentationSource(displayEmployee, listVariant)
				: "custom",
		[displayEmployee, listVariant],
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
											className="text-center text-[20px] font-bold leading-tight text-foreground"
											data-testid="my-crew-detail-sheet-title"
										>
											{displayEmployee.name?.trim() ||
												t("detailDialog.emptyName")}
										</p>
										{displayEmployee.role?.trim() ? (
											<span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[11px] font-medium leading-none text-primary">
												{displayEmployee.role.trim()}
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
												{displayEmployee.playbooks.map((playbook) => (
													<span
														key={playbook.name}
														className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[13px] font-medium leading-none text-primary"
													>
														{playbook.name}
													</span>
												))}
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
					<button
						type="button"
						onClick={handleChat}
						className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary transition-opacity active:opacity-80"
						data-testid="my-crew-detail-sheet-chat-button"
					>
						<MessageCircle className="h-5 w-5 text-white" />
						<span className="text-[16px] font-semibold text-white">
							{t("myCrewPage.detailSheet.startChat")}
						</span>
					</button>
				</div>
			</SheetContent>
		</Sheet>
	)
}
