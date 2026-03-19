import { useIsMobile } from "@/hooks/use-mobile"
import { useMount } from "ahooks"

function preloadRecordSummaryEditorPanel() {
	return import("@/components/business/RecordingSummary/EditorPanel")
}

const preloadChatMessageEditor = () => {
	return import("@/pages/superMagic/pages/Assistant/components/Conversation/components/MessageEditor")
}

/**
 * 预加载消息编辑器组件
 */
export const usePreload = () => {
	const isMobile = useIsMobile()

	useMount(() => {
		requestIdleCallback(() => {
			preloadRecordSummaryEditorPanel()
			if (!isMobile) {
				preloadChatMessageEditor()
			}
		})
	})
}
