import { memo } from "react"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import KnowledgeBasePreviewContent from "@/pages/superMagic/components/Detail/components/KnowledgeBasePreviewContent"
import type { UseMobileKnowledgeBasePreviewReturn } from "@/pages/superMagic/hooks/useMobileKnowledgeBasePreview"

interface KnowledgeBasePreviewPopupProps {
	state: UseMobileKnowledgeBasePreviewReturn
}

function KnowledgeBasePreviewPopup({ state }: KnowledgeBasePreviewPopupProps) {
	const { close, previewData, visible } = state

	return (
		<CommonPopup
			title={previewData?.title || ""}
			popupProps={{
				visible,
				onClose: close,
				bodyStyle: {
					height: "calc(100dvh - 24px)",
				},
			}}
		>
			{previewData ? (
				<div className="h-full min-h-0">
					<KnowledgeBasePreviewContent data={previewData} />
				</div>
			) : null}
		</CommonPopup>
	)
}

export default memo(KnowledgeBasePreviewPopup)
