import { Suspense, lazy, useRef } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import MagicSplitter from "@/components/base/MagicSplitter"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn-ui/sheet"
import ChatSubSider from "../ChatSubSider"
import MainContent from "../MainContent"
import ChatImagePreviewModal from "../ChatImagePreviewModal"
import conversationStore from "@/stores/chatNew/conversation"
import { interfaceStore } from "@/stores/interface"
import MessageFilePreviewStore from "@/stores/chatNew/messagePreview/FilePreviewStore"
import { ChatDomId } from "../../constants"
import { usePanelSizes } from "../../hooks/usePanelSizes"
import { useChatWorkspaceLayout, chatWorkspaceSpec } from "../../layout"
import MessageFilePreviewService from "@/services/chat/message/MessageFilePreview"

// 懒加载组件
const ChatFilePreviewPanel = lazy(() => import("../ChatFilePreviewPanel"))
const GroupSeenPanel = lazy(() => import("../GroupSeenPanel"))

/**
 * 聊天容器组件
 * 包含完整的聊天界面布局
 */
const ChatContainer = observer(function ChatContainer() {
	const { t } = useTranslation("chat")
	const containerRef = useRef<HTMLDivElement>(null)
	const workspaceLayout = useChatWorkspaceLayout(containerRef, chatWorkspaceSpec)
	const previewInDrawer = workspaceLayout.mode !== "three-column"

	const { sizes, totalWidth, mainMinWidth, handleSiderResize, handleInputResize } =
		usePanelSizes(previewInDrawer)
	const siderSize = sizes[0] ?? interfaceStore.chatSiderDefaultWidth

	return (
		<div
			ref={containerRef}
			className="flex size-full min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted"
			id={ChatDomId.ChatContainer}
			data-layout-mode={workspaceLayout.mode}
		>
			<MagicSplitter onResize={handleSiderResize}>
				{workspaceLayout.mode !== "focus-main" && (
					<MagicSplitter.Panel
						min={200}
						defaultSize={interfaceStore.chatSiderDefaultWidth}
						size={siderSize}
						max={300}
					>
						<ChatSubSider />
					</MagicSplitter.Panel>
				)}
				<MagicSplitter.Panel
					size={workspaceLayout.mode === "focus-main" ? "100%" : sizes[1]}
					className="!grow"
				>
					<MainContent onInputResize={handleInputResize} />
				</MagicSplitter.Panel>
				{MessageFilePreviewStore.open && !previewInDrawer && (
					<MagicSplitter.Panel
						max={totalWidth - siderSize - mainMinWidth}
						min="20%"
						size={sizes[2]}
					>
						<Suspense fallback={null}>
							<ChatFilePreviewPanel />
						</Suspense>
					</MagicSplitter.Panel>
				)}
			</MagicSplitter>
			<Sheet
				open={MessageFilePreviewStore.open && previewInDrawer}
				onOpenChange={(open) => {
					if (!open) MessageFilePreviewService.clearPreviewInfo()
				}}
			>
				<SheetContent
					side="right"
					showClose={false}
					className="!inset-y-0 !right-0 !h-full !w-[clamp(320px,80vw,480px)] !max-w-none !gap-0 !overflow-hidden !p-0"
				>
					<SheetTitle className="sr-only">{t("preview.filePreview")}</SheetTitle>
					<SheetDescription className="sr-only">
						{t("preview.fileDrawerDesc")}
					</SheetDescription>
					<Suspense fallback={null}>
						<ChatFilePreviewPanel className="h-full" />
					</Suspense>
				</SheetContent>
			</Sheet>
			<ChatImagePreviewModal />
			{conversationStore.currentConversation?.isGroupConversation && (
				<Suspense fallback={null}>
					<GroupSeenPanel />
				</Suspense>
			)}
		</div>
	)
})

export default ChatContainer
