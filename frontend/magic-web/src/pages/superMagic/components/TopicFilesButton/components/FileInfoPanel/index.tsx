import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import type { AttachmentItem } from "../../hooks/types"
import FileInfoContent from "./components/FileInfoContent"
import { buildFileInfoModel } from "./utils"

interface FileInfoPanelProps {
	open: boolean
	item?: AttachmentItem | null
	onClose: () => void
}

function FileInfoPanel({ open, item, onClose }: FileInfoPanelProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const model = useMemo(() => (item ? buildFileInfoModel(item) : null), [item])

	if (!model) return null

	const content = <FileInfoContent model={model} />

	if (isMobile) {
		return (
			<CommonPopup
				title={t("topicFiles.fileInfo.title")}
				popupProps={{
					visible: open,
					onClose,
					bodyClassName: "!p-0",
					bodyStyle: { height: "78vh" },
				}}
			>
				<div className={cn("h-full", "[&>div]:max-h-full")}>{content}</div>
			</CommonPopup>
		)
	}

	return (
		<MagicModal
			open={open}
			title={t("topicFiles.fileInfo.title")}
			footer={null}
			width={560}
			onCancel={onClose}
			destroyOnClose
			classNames={{ body: "!overflow-hidden !p-0" }}
		>
			{content}
		</MagicModal>
	)
}

export default memo(FileInfoPanel)
