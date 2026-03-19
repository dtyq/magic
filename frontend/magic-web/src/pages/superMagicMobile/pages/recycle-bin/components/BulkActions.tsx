import { memo, useState, useCallback } from "react"
import type { CSSProperties } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import ActionSheet from "@/pages/superMagicMobile/components/ActionSheet"

interface BulkActionsProps {
	selectedCount: number
	totalCount: number
	onSelectAll: () => void
	onDeselectAll: () => void
	onRestore: () => void
	onPermanentDelete: () => void
}

function BulkActions(props: BulkActionsProps) {
	const { selectedCount, totalCount, onSelectAll, onDeselectAll, onRestore, onPermanentDelete } =
		props

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
		onRestore()
	}, [onRestore])

	const handlePermanentDelete = useCallback(() => {
		setDrawerOpen(false)
		onPermanentDelete()
	}, [onPermanentDelete])

	return (
		<div
			className="flex w-full items-center gap-1.5 border-t border-[#E5E5E5] bg-background px-3 py-3"
			data-testid="mobile-recycle-bin-bulk-actions"
		>
			<Button
				variant="outline"
				className="h-9 rounded-lg border-[#E5E5E5] px-8 text-sm font-medium leading-5 text-foreground shadow-sm"
				onClick={handleSelectAllClick}
				data-testid="mobile-recycle-bin-select-all"
			>
				{isAllSelected
					? t("mobile.recycleBin.bulkActions.deselectAll")
					: t("mobile.recycleBin.bulkActions.selectAll")}
			</Button>

			<Button
				variant="default"
				className="h-9 flex-1 rounded-lg bg-[#171717] px-4 text-sm font-medium leading-5 text-white shadow-sm hover:bg-[#262626]"
				disabled={selectedCount === 0}
				data-testid="mobile-recycle-bin-bulk-actions-trigger"
				onClick={() => setDrawerOpen(true)}
			>
				{t("mobile.recycleBin.bulkActions.title")}
				<ChevronDown className="ml-2 size-4" />
			</Button>

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
