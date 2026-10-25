import { lazy, memo, Suspense } from "react"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import type { UseMobileKnowledgeBasePreviewReturn } from "@/pages/superMagic/hooks/useMobileKnowledgeBasePreview"

// 未打开来源文件时，消息列表只保留弹层入口，不加载完整来源预览。
const KnowledgeBasePreviewContent = lazy(
	() => import("@/pages/superMagic/components/Detail/components/KnowledgeBasePreviewContent"),
)

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
					<Suspense fallback={null}>
						<KnowledgeBasePreviewContent data={previewData} />
					</Suspense>
				</div>
			) : null}
		</CommonPopup>
	)
}

export default memo(KnowledgeBasePreviewPopup)
