import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { Coins, ListFilter, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { userStore } from "@/models/user"
import { useTimezone } from "@/providers/TimezoneProvider/hooks"
import { cn } from "@/lib/utils"
import {
	MOBILE_SETTINGS_CARD_CLASSNAME,
	MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
} from "./constants"
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

/** 积分购买页只负责承载共享 UI，具体充值实现通过能力注入层接入。 */
export function MobileSettingsPointsSheet(props: { open: boolean; onClose: () => void }) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")
	const { points, canRecharge } = getMobileSettingsPointsPurchaseState()

	/** 充值按钮统一委托给能力注入层，缺少实现时回退到占位提示。 */
	const handleOpenRecharge = useMemoizedFn(() => {
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
			<div className="flex flex-col gap-4">
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

				<div className={MOBILE_SETTINGS_CARD_CLASSNAME}>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Coins className="h-4 w-4" />
						<span>{t("bonusPointsModal.availablePoints")}</span>
					</div>
					<div className="mt-1 text-3xl font-semibold leading-none text-foreground">
						{new Intl.NumberFormat().format(points)}
					</div>
					<div className="mt-2 text-xs text-muted-foreground">
						{t("setting.pointsPurchase.priceTip")}
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
	const [activeRecord, setActiveRecord] = useState<PointsRecordItem | null>(null)

	/** 父级积分明细浮层关闭时顺带收起详情浮层，避免再次进入时停留在旧记录。 */
	useEffect(() => {
		if (!open) {
			setActiveRecord(null)
		}
	}, [open])

	useEffect(() => {
		if (!open) return

		let cancelled = false

		/** 打开积分明细浮层时才触发加载，让视图层只负责调用已收敛好的数据 helper。 */
		async function fetchPointsRecords() {
			setLoading(true)

			try {
				if (cancelled) return

				const nextRecords = await loadMobileSettingsPointsRecords(
					t("bonusPointsModal.pointsChange"),
				)

				if (cancelled) return

				setRecords(nextRecords)
			} catch {
				if (!cancelled) {
					toast.error(t("common.loadFailed"))
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		void fetchPointsRecords()

		return () => {
			cancelled = true
		}
	}, [open, t])

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
				dataTestId="mobile-settings-points-detail-sheet"
			>
				<div className="flex flex-col gap-2.5 px-[14px] pt-2">
					<div className="flex items-center gap-3 rounded-lg bg-card px-4 py-4">
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

					{loading ? (
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
						groupedRecords.map((group) => (
							<div key={group.label} className="flex flex-col gap-2">
								<div className="px-[14px] text-[14px] leading-5 text-muted-foreground">
									{group.label}
								</div>
								<div className="overflow-hidden rounded-lg bg-card">
									{group.items.map((item, index) => (
										<MobileSettingsPointsRecordRow
											key={item.id}
											item={item}
											timezone={timezone}
											showDivider={index < group.items.length - 1}
											onClick={() => handleOpenRecordDetail(item)}
										/>
									))}
								</div>
							</div>
						))
					)}
				</div>
			</MobileSettingsSheetContainer>

			<MobileSettingsPointsRecordDetailSheet
				item={activeRecord}
				open={Boolean(activeRecord)}
				onClose={() => {
					setActiveRecord(null)
				}}
				timezone={timezone}
				recordIdLabel={t("recordId")}
				timeLabel={t("time")}
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
			headerAction={
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={t("button.filter")}
					disabled
					className={cn(
						MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
						"right-2.5 bg-card text-foreground",
					)}
					data-testid="mobile-settings-order-history-filter-placeholder"
				>
					<ListFilter className="h-5 w-5" />
				</Button>
			}
			// 订单记录是长列表场景，固定接近全屏高度以保留更多可视订单并匹配原型层级。
			sheetClassName="h-[90dvh]"
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
