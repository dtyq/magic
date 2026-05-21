import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import showOnlineFeedbackModal from "@/components/business/OnlineFeedbackModal"
import { OnlineFeedbackModalType } from "@/components/business/OnlineFeedbackModal/types"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { PointsMenuIcon } from "@/pages/user/pages/my/assets/PointsMenuIcon"
import { isCommercial, isPrivateDeployment } from "@/utils/env"

import {
	formatPointsRecordAmount,
	getPointsRecordDetailMetaRows,
	getPointsRecordListTitle,
} from "../pointsRecordDisplay"
import type { PointsRecordItem } from "../types"
import { MobileSettingsSheetContainer } from "./SheetContainer"

/** 积分记录详情：字段与交互对齐 enterprise PointsList/Details.tsx。 */
export function MobileSettingsPointsRecordDetailSheet(props: {
	item: PointsRecordItem | null
	open: boolean
	onClose: () => void
}) {
	const { item, open, onClose } = props
	const { t } = useTranslation(["interface", "super"])

	const handleFeedback = useMemoizedFn(() => {
		if (!item) return

		void showOnlineFeedbackModal({
			type: OnlineFeedbackModalType.PointsChange,
			details: {
				id: item.id,
				amount: String(item.amount),
				label: item.label,
				description: item.description,
				created_at: item.createdAt,
				updated_at: item.updatedAt,
			},
		})
	})

	if (!item) return null

	const detailTitle = getPointsRecordListTitle(
		item.description,
		t("topic.unnamedTopic", { ns: "super" }),
	)
	const formattedAmount = formatPointsRecordAmount(item.amount)
	const metaRows = getPointsRecordDetailMetaRows(item, {
		recordId: t("bonusPointsModal.recordId"),
		time: t("bonusPointsModal.time"),
	})
	const showFeedback = isCommercial() && !isPrivateDeployment()

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("bonusPointsModal.pointsRecord")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			contentClassName="flex min-h-0 flex-1 flex-col gap-3 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-points-record-detail-sheet"
		>
			<div className="flex flex-1 flex-col items-center gap-6 overflow-hidden rounded-lg bg-card px-6 py-12">
				<div
					className="flex size-12 items-center justify-center rounded-full bg-muted"
					aria-hidden
				>
					<PointsMenuIcon size={24} />
				</div>

				<div className="text-center text-sm text-foreground">{detailTitle}</div>

				<div className="text-2xl font-medium tabular-nums text-foreground">
					{formattedAmount}
				</div>

				<Separator className="w-full border-b" />

				<div className="flex w-full flex-col gap-2.5">
					{metaRows.map((row) => (
						<div
							key={row.key}
							className="flex items-center gap-1 text-xs text-muted-foreground"
						>
							{row.text}
						</div>
					))}
				</div>
			</div>

			{showFeedback ? (
				<div className="flex h-9 w-full shrink-0 items-center justify-center px-8">
					<Button
						type="button"
						variant="ghost"
						onClick={handleFeedback}
						className="text-sm font-normal text-foreground"
						data-testid="mobile-settings-points-record-feedback"
					>
						{t("bonusPointsModal.problemFeedback")}
					</Button>
				</div>
			) : null}
		</MobileSettingsSheetContainer>
	)
}
