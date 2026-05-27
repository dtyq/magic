import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { throttle } from "lodash-es"
import { Coins, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { userStore } from "@/models/user"
import { useTimezone } from "@/providers/TimezoneProvider/hooks"
import { isPrivateDeployment } from "@/utils/env"
import MagicModal from "@/components/base/MagicModal"
import { MOBILE_SETTINGS_CARD_CLASSNAME, MOBILE_SETTINGS_SHEET_HEIGHT_CLASSNAME } from "./constants"
import { MobileSettingsPointsRecordDetailSheet } from "./components/PointsRecordDetailSheet"
import { MobileSettingsPointsRecordRow } from "./components/PointsRecordRow"
import { MobileSettingsSheetContainer } from "./components/SheetContainer"
import type { PointsRecordItem } from "./types"
import {
	getMobileSettingsPaidPackageContainerId,
	getMobileSettingsPointsPurchaseState,
	groupPointsRecords,
	loadMobileSettingsOrderHistoryPanel,
	loadMobileSettingsPointsRecords,
	openMobileSettingsPointsRecharge,
} from "./utils"

const MobileSettingsOrderHistoryPanelContent = lazy(loadMobileSettingsOrderHistoryPanel)

/** 积分明细每页条数，与 PointsList、SubscriptionBill 保持一致。 */
const POINTS_RECORDS_PAGE_SIZE = 20

/** 积分购买页只负责承载共享 UI，具体充值实现通过能力注入层接入。 */
export function MobileSettingsPointsSheet(props: { open: boolean; onClose: () => void }) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")
	const { points, canRecharge } = getMobileSettingsPointsPurchaseState()
	const { isAdmin, isPersonalOrganization } = userStore.user
	const canOperate = isAdmin || isPersonalOrganization
	const privateDeploy = isPrivateDeployment()

	/** 充值按钮统一委托给能力注入层，缺少实现时回退到占位提示。 */
	const handleOpenRecharge = useMemoizedFn(() => {
		if (!canOperate) {
			const modal = MagicModal.info({
				icon: null,
				closable: false,
				title: t("bonusPointsModal.contactAdmin"),
				content: t("bonusPointsModal.contactAdminContent"),
				centered: true,
				onOk: () => modal.destroy(),
				okText: t("common.confirm"),
			})
			return
		}

		openMobileSettingsPointsRecharge(() => {
			toast.info(t("setting.comingSoon"))
		})
	})

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("bonusPointsModal.purchasePoints")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			ignoreOutsideInteractContainerId={
				getMobileSettingsPaidPackageContainerId() || undefined
			}
			dataTestId="mobile-settings-points-sheet"
		>
			<div className="mt-2 flex flex-col gap-4">
				{!privateDeploy && (
					<div className={MOBILE_SETTINGS_CARD_CLASSNAME}>
						<div className="text-sm font-medium text-foreground">
							{canRecharge
								? t("bonusPointsModal.availablePointsPackage")
								: t("setting.pointsPurchase.lockedTitle")}
						</div>
						<div className="mt-1 text-sm text-muted-foreground">
							{canRecharge
								? t("bonusPointsModal.purchasePointsTip")
								: t("setting.pointsPurchase.lockedDescription")}
						</div>
						<Button
							type="button"
							className="mt-3 rounded-full px-4"
							onClick={handleOpenRecharge}
						>
							{t("bonusPointsModal.goToRecharge")}
						</Button>
					</div>
				)}

				<div className={MOBILE_SETTINGS_CARD_CLASSNAME}>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Coins className="h-4 w-4" />
						<span>{t("bonusPointsModal.availablePoints")}</span>
					</div>
					<div className="mt-1 text-3xl font-semibold leading-none text-foreground">
						{new Intl.NumberFormat().format(points)}
					</div>
				</div>
			</div>
		</MobileSettingsSheetContainer>
	)
}

/** 积分明细页继续复用现有数据 helper，保持列表展示和数据装配职责分离。 */
export function MobileSettingsPointsDetailSheet(props: { open: boolean; onClose: () => void }) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")
	const { timezone } = useTimezone()
	const [loading, setLoading] = useState(false)
	const [records, setRecords] = useState<PointsRecordItem[]>([])
	const [hasMore, setHasMore] = useState(true)
	const [currentPage, setCurrentPage] = useState(1)
	const [activeRecord, setActiveRecord] = useState<PointsRecordItem | null>(null)

	const loaderRef = useRef<HTMLDivElement>(null)
	const fallbackLabel = t("bonusPointsModal.pointsChange")

	/** 父级积分明细浮层关闭时顺带收起详情浮层，避免再次进入时停留在旧记录。 */
	useEffect(() => {
		if (!open) {
			setActiveRecord(null)
			setRecords([])
			setCurrentPage(1)
			setHasMore(true)
		}
	}, [open])

	/** 按页拉取积分明细，首屏替换列表，滚动加载时追加。 */
	const loadData = useMemoizedFn(async (page: number, isLoadMore = false) => {
		if (loading) return

		try {
			setLoading(true)

			const { records: nextRecords, hasMore: nextHasMore } =
				await loadMobileSettingsPointsRecords(fallbackLabel, {
					page,
					pageSize: POINTS_RECORDS_PAGE_SIZE,
				})

			if (isLoadMore) {
				setRecords((prev) => [...prev, ...nextRecords])
			} else {
				setRecords(nextRecords)
			}

			setHasMore(nextHasMore)
		} catch {
			toast.error(t("common.loadFailed"))
		} finally {
			setLoading(false)
		}
	})

	/** 触底加载下一页，页码在请求前递增。 */
	const handleLoadMore = useMemoizedFn(async () => {
		if (!hasMore) return

		const nextPage = currentPage + 1
		setCurrentPage(nextPage)
		await loadData(nextPage, true)
	})

	const throttledLoadMore = useMemo(() => throttle(handleLoadMore, 1000), [handleLoadMore])

	/** 底部哨兵进入视口时触发加载更多，与订单明细页一致。 */
	useEffect(() => {
		if (!open || !loaderRef.current) return

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries
				if (entry.isIntersecting && hasMore && !loading) {
					throttledLoadMore()
				}
			},
			{ threshold: 0.1 },
		)

		const currentLoader = loaderRef.current
		observer.observe(currentLoader)

		return () => {
			throttledLoadMore.cancel()
			observer.unobserve(currentLoader)
		}
	}, [open, hasMore, loading, throttledLoadMore])

	/** 浮层打开时重置分页并拉取第一页。 */
	useEffect(() => {
		if (!open) return

		setCurrentPage(1)
		setRecords([])
		setHasMore(true)
		void loadData(1, false)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	const groupedRecords = useMemo(
		() => groupPointsRecords(records, timezone, (key) => t(key)),
		[records, t, timezone],
	)

	/** 列表项点击后只把选中的记录抬升到当前浮层状态，详情展示继续留在 UI 层处理。 */
	const handleOpenRecordDetail = useMemoizedFn((item: PointsRecordItem) => {
		setActiveRecord(item)
	})

	return (
		<>
			<MobileSettingsSheetContainer
				open={open}
				title={t("bonusPointsModal.pointsDetail")}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) onClose()
				}}
				// Filter entry hidden until API-backed filtering is available.
				sheetClassName={MOBILE_SETTINGS_SHEET_HEIGHT_CLASSNAME}
				dataTestId="mobile-settings-points-detail-sheet"
			>
				<div className="flex flex-col gap-2.5 pb-[calc(var(--safe-area-inset-bottom)+16px)] pt-2">
					<div className="flex shrink-0 items-center gap-3 rounded-lg bg-card px-4 py-4">
						<div
							className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
							aria-hidden
						>
							<Sparkles className="h-5 w-5 text-primary" strokeWidth={2} />
						</div>
						<div className="min-w-0">
							<div className="text-[12px] leading-4 text-muted-foreground">
								{t("bonusPointsModal.availablePoints")}
							</div>
							<div className="mt-1 text-[24px] font-semibold tabular-nums leading-7 text-foreground">
								{new Intl.NumberFormat().format(
									userStore.user.organizationPoints || 0,
								)}
							</div>
						</div>
					</div>

					{/* 仅在首屏尚无数据时显示整页 loading，避免分页追加时卸载列表导致滚动位置回到顶部。 */}
					{loading && records.length === 0 ? (
						<div className="flex flex-col items-center justify-center px-4 py-12 text-center">
							<div className="mb-3 flex size-12 items-center justify-center rounded-full bg-card">
								<Sparkles
									className="h-6 w-6 text-muted-foreground"
									strokeWidth={1.75}
									aria-hidden
								/>
							</div>
							<div className="text-[16px] font-medium leading-6 text-foreground">
								{t("common.loading")}
							</div>
						</div>
					) : groupedRecords.length === 0 ? (
						<div className="flex flex-col items-center justify-center px-4 py-12 text-center">
							<div className="mb-3 flex size-12 items-center justify-center rounded-full bg-card">
								<Sparkles
									className="h-6 w-6 text-muted-foreground"
									strokeWidth={1.75}
									aria-hidden
								/>
							</div>
							<div className="text-[16px] font-medium leading-6 text-foreground">
								{t("setting.pointsHistoryEmpty")}
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-4">
							{groupedRecords.map((group) => (
								<div key={group.label} className="flex flex-col gap-2">
									<div className="text-[14px] leading-5 text-muted-foreground">
										{group.label}
									</div>
									<div className="overflow-hidden rounded-lg bg-card">
										{group.items.map((item, index) => (
											<MobileSettingsPointsRecordRow
												key={item.id}
												item={item}
												showDivider={index < group.items.length - 1}
												onClick={() => handleOpenRecordDetail(item)}
											/>
										))}
									</div>
								</div>
							))}

							{hasMore ? (
								<div
									ref={loaderRef}
									className="py-4 text-center text-sm text-muted-foreground"
									data-testid="mobile-settings-points-detail-load-more"
								>
									{loading ? t("common.loading") : null}
								</div>
							) : null}

							{!hasMore && records.length > 0 ? (
								<div className="flex items-center justify-center gap-2.5 py-4">
									<Separator className="!w-8" />
									<div className="text-sm text-muted-foreground">
										{t("bonusPointsModal.allLoaded")}
									</div>
									<Separator className="!w-8" />
								</div>
							) : null}
						</div>
					)}
				</div>
			</MobileSettingsSheetContainer>

			<MobileSettingsPointsRecordDetailSheet
				item={activeRecord}
				open={Boolean(activeRecord)}
				onClose={() => {
					setActiveRecord(null)
				}}
			/>
		</>
	)
}

/** 订单记录 sheet 只保留共享外层容器，实际内容通过能力注入层懒加载。 */
export function MobileSettingsOrderHistorySheet(props: { open: boolean; onClose: () => void }) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.orderRecords")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			// 筛选能力待接口支持后再通过 headerAction 开放，暂时隐藏避免占位按钮误导用户。
			// 订单记录是长列表场景，固定接近全屏高度以保留更多可视订单并匹配原型层级。
			sheetClassName={MOBILE_SETTINGS_SHEET_HEIGHT_CLASSNAME}
			contentClassName="min-h-0 flex-1 overflow-hidden p-0"
			dataTestId="mobile-settings-order-history-sheet"
		>
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{t("common.loading")}
					</div>
				}
			>
				<MobileSettingsOrderHistoryPanelContent embedded onClose={onClose} />
			</Suspense>
		</MobileSettingsSheetContainer>
	)
}
