import { memo } from "react"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import MicroAppPreviewContent from "@/pages/superMagic/components/Detail/components/MicroAppPreviewContent"
import type { UseMobileMicroAppPreviewReturn } from "@/pages/superMagic/hooks/useMobileMicroAppPreview"

interface MicroAppPreviewPopupProps {
	state: UseMobileMicroAppPreviewReturn
}

function MicroAppPreviewPopup({ state }: MicroAppPreviewPopupProps) {
	const { close, previewData, visible } = state

	return (
		<CommonPopup
			title={previewData?.appName || previewData?.appId || ""}
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
					<MicroAppPreviewContent
						appId={previewData.appId}
						appName={previewData.appName}
						onLeave={close}
					/>
				</div>
			) : null}
		</CommonPopup>
	)
}

export default memo(MicroAppPreviewPopup)
