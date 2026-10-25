import { memo } from "react"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { ShareResourceApiItem } from "../../ShareManagement/types"
import SimilarShareItem from "../components/SimilarShareItem"

interface SimilarSharesDialogProps {
	open: boolean
	onClose: () => void
	shares: ShareResourceApiItem[]
	onSelectShare: (share: ShareResourceApiItem) => void
	onCreateNew: () => void
}

function SimilarSharesDialog({
	open,
	onClose,
	shares,
	onSelectShare,
	onCreateNew,
}: SimilarSharesDialogProps) {
	const { t } = useTranslation("super")

	const handleSelectShare = (share: ShareResourceApiItem) => {
		onSelectShare(share)
		onClose()
	}

	const handleCreateNew = () => {
		onCreateNew()
		onClose()
	}

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent
				className="max-w-[600px] gap-0 border-none p-0"
				onPointerDownOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
				style={{ zIndex: 1200 }}
				data-testid="on-pointer-down-outside"
			>
				<DialogHeader
					className="border-b border-border px-3 py-3"
					data-testid="similar-shares-dialog-header"
				>
					<DialogTitle className="text-base font-semibold">
						{t("share.useSimilarShare")}
					</DialogTitle>
				</DialogHeader>

				{/* Keep the dialog content-sized while limiting the actual list viewport. */}
				<ScrollArea viewportClassName="h-auto max-h-[500px] p-5 [&>div]:!flex [&>div]:flex-col [&>div]:gap-3">
					{shares.map((share) => (
						<SimilarShareItem
							key={share.resource_id}
							item={share}
							onClick={handleSelectShare}
							showStats
						/>
					))}
				</ScrollArea>

				<DialogFooter
					className="border-t border-border px-3 py-3"
					data-testid="similar-shares-dialog-footer"
				>
					<div className="flex items-center gap-1.5">
						<Button
							variant="outline"
							onClick={onClose}
							className="h-9"
							data-testid="on-close"
						>
							{t("common.cancel")}
						</Button>
						<Button
							onClick={handleCreateNew}
							className="h-9"
							data-testid="handle-create-new"
						>
							{t("share.createNewShare")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default memo(SimilarSharesDialog)
