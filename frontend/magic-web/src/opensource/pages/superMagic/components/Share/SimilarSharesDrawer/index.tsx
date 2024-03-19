import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/opensource/components/shadcn-ui/button"
import CommonPopup from "@/opensource/pages/superMagicMobile/components/CommonPopup"
import type { ShareResourceApiItem } from "../../ShareManagement/types"
import SimilarShareItem from "../components/SimilarShareItem"

interface SimilarSharesDrawerProps {
	open: boolean
	onClose: () => void
	shares: ShareResourceApiItem[]
	onSelectShare: (share: ShareResourceApiItem) => void
	onCreateNew: () => void
}

function SimilarSharesDrawer({
	open,
	onClose,
	shares,
	onSelectShare,
	onCreateNew,
}: SimilarSharesDrawerProps) {
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
		<CommonPopup
			popupProps={{
				visible: open,
				onClose,
				showCloseButton: false,
				bodyClassName: "!p-0",
				bodyStyle: {
					height: "auto",
				},
			}}
			title={t("share.useSimilarShare")}
		>
			{/* 内容区域 */}
			<div className="flex flex-col gap-3 p-3 pb-[70px]">
				{shares.map((share) => (
					<SimilarShareItem
						key={share.resource_id}
						item={share}
						onClick={handleSelectShare}
					/>
				))}
			</div>

			{/* 底部按钮 */}
			<div className="absolute bottom-0 left-0 right-0 flex gap-1.5 border-t border-border bg-background p-3">
				<Button variant="secondary" onClick={onClose} className="h-9 flex-1 px-8">
					{t("common.cancel")}
				</Button>
				<Button onClick={handleCreateNew} className="h-9 flex-1">
					{t("share.createNewShare")}
				</Button>
			</div>
		</CommonPopup>
	)
}

export default memo(SimilarSharesDrawer)
