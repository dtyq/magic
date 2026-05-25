import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import type { RecycleBinItemData } from "./RecycleBinItem"
import { RecycleBinOrphanRow } from "./recycle-bin-item-display"

interface RecycleBinOrphanWarnSheetProps {
	open: boolean
	orphanItems: RecycleBinItemData[]
	restorableCount: number
	onCancel: () => void
	onRestoreOthers: () => void
}

/**
 * Mixed restore warning: some selected items cannot return to original parent.
 * UI aligned with prototype trash.restore.orphanWarn.
 */
function RecycleBinOrphanWarnSheet(props: RecycleBinOrphanWarnSheetProps) {
	const { open, orphanItems, restorableCount, onCancel, onRestoreOthers } = props
	const { t } = useTranslation("super")

	const canRestoreOthers = restorableCount > 0

	return (
		<Sheet open={open} onOpenChange={(next) => !next && onCancel()}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex h-auto max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="mobile-recycle-bin-orphan-mixed-sheet"
			>
				<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
					<div className="h-1 w-20 rounded-full bg-muted-foreground/40" aria-hidden />
				</div>

				<div className="relative flex h-14 w-full shrink-0 items-center justify-center px-4 py-2">
					<SheetTitle className="max-w-[280px] truncate text-center text-[18px] font-semibold leading-none text-foreground">
						{t("mobile.recycleBin.orphanWarn.title")}
					</SheetTitle>
				</div>

				<div className="flex flex-col gap-3 px-4 pt-1">
					<p className="text-[14px] leading-5 text-muted-foreground">
						{t("mobile.recycleBin.orphanWarn.intro", { count: orphanItems.length })}
					</p>

					<div className="max-h-[40dvh] overflow-y-auto rounded-lg bg-card">
						{orphanItems.map((item, index) => (
							<div key={item.id}>
								{index > 0 ? <div className="h-px w-full bg-border" /> : null}
								<RecycleBinOrphanRow
									type={item.type}
									title={item.title}
									path={item.path}
									typeLabel={t(`mobile.recycleBin.item.type.${item.type}`)}
								/>
							</div>
						))}
					</div>

					<p className="text-[13px] leading-5 text-muted-foreground">
						{canRestoreOthers
							? t("mobile.recycleBin.orphanWarn.remaining", {
									count: restorableCount,
								})
							: t("mobile.recycleBin.orphanWarn.noneRestorable")}
					</p>
				</div>

				<div className="flex items-center gap-2 px-4 pb-6 pt-4">
					<button
						type="button"
						onClick={onCancel}
						className="h-12 flex-1 rounded-full bg-card text-[15px] font-medium text-foreground active:opacity-70"
						style={{ boxShadow: "0px 4px 12px rgba(0,0,0,0.06)" }}
						data-testid="mobile-recycle-bin-orphan-cancel"
					>
						{t("mobile.recycleBin.orphanWarn.cancel")}
					</button>
					{canRestoreOthers ? (
						<button
							type="button"
							onClick={onRestoreOthers}
							aria-label={t("mobile.recycleBin.orphanWarn.restoreOthersAria")}
							className="h-12 flex-1 rounded-full bg-primary text-[15px] font-medium text-primary-foreground active:opacity-80"
							style={{ boxShadow: "0px 4px 12px rgba(0,0,0,0.10)" }}
							data-testid="mobile-recycle-bin-orphan-restore-direct"
						>
							{t("mobile.recycleBin.orphanWarn.restoreOthers", {
								count: restorableCount,
							})}
						</button>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	)
}

export default memo(RecycleBinOrphanWarnSheet)
