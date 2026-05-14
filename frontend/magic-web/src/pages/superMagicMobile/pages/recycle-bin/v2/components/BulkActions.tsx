import { memo, useState, useCallback } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import ActionSheet from "@/pages/superMagicMobile/components/ActionSheet"

interface BulkActionsProps {
	selectedCount: number
	totalCount: number
	onSelectAll: () => void
	onDeselectAll: () => void
	/** 打开还原确认（不直接调接口） */
	onRequestRestore: () => void
	/** 打开彻底删除确认 */
	onRequestPermanentDelete: () => void
	selectAllLabel: string
	deselectAllLabel: string
}

function BulkActions(props: BulkActionsProps) {
	const {
		selectedCount,
		totalCount,
		onSelectAll,
		onDeselectAll,
		onRequestRestore,
		onRequestPermanentDelete,
		selectAllLabel,
		deselectAllLabel,
	} = props

	const { t } = useTranslation("super")
	const [drawerOpen, setDrawerOpen] = useState(false)
	const isAllSelected = selectedCount === totalCount && totalCount > 0

	const handleSelectAllClick = useCallback(() => {
		if (isAllSelected) {
			onDeselectAll()
		} else {
			onSelectAll()
		}
	}, [isAllSelected, onDeselectAll, onSelectAll])

	const handleRestore = useCallback(() => {
		setDrawerOpen(false)
		onRequestRestore()
	}, [onRequestRestore])

	const handlePermanentDelete = useCallback(() => {
		setDrawerOpen(false)
		onRequestPermanentDelete()
	}, [onRequestPermanentDelete])

	return (
		<div
			className="shrink-0 border-t border-border bg-background px-3 py-3"
			data-testid="mobile-recycle-bin-bulk-actions"
		>
			<div className="flex w-full items-center gap-1.5">
				<Button
					variant="outline"
					className="h-9 rounded-lg border-border px-8 text-sm font-medium leading-5 text-foreground shadow-sm"
					onClick={handleSelectAllClick}
					data-testid="mobile-recycle-bin-select-all"
				>
					{isAllSelected ? deselectAllLabel : selectAllLabel}
				</Button>

				<Button
					variant="default"
					className="h-9 flex-1 rounded-lg bg-foreground px-4 text-sm font-medium leading-5 text-background shadow-sm hover:bg-foreground/90"
					disabled={selectedCount === 0}
					data-testid="mobile-recycle-bin-bulk-actions-trigger"
					onClick={() => setDrawerOpen(true)}
				>
					{t("mobile.recycleBin.bulkActions.title")}
					<ChevronDown className="ml-2 size-4" />
				</Button>
			</div>

			<ActionSheet
				visible={drawerOpen}
				title={t("mobile.recycleBin.bulkActions.title")}
				actionGroups={[
					{
						actions: [
							{
								key: "restore",
								label: t("mobile.recycleBin.bulkActions.restore"),
								onClick: handleRestore,
							},
							{
								key: "permanentDelete",
								label: t("mobile.recycleBin.bulkActions.permanentDelete"),
								variant: "danger",
								onClick: handlePermanentDelete,
							},
						],
					},
				]}
				showCancel
				cancelText={t("common.cancel")}
				onClose={() => setDrawerOpen(false)}
			/>
		</div>
	)
}

export default memo(BulkActions)
