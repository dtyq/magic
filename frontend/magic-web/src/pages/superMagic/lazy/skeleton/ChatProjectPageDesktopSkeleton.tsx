import TopicPageDesktopSkeleton from "./TopicPageDesktopSkeleton"

/** Desktop chat detail skeleton keeps the same structure as the real page to avoid extra placeholder separators. */
function ChatProjectPageDesktopSkeleton() {
	return (
		<div
			className="flex h-full min-h-0 w-full flex-col"
			data-testid="chat-project-page-desktop-skeleton"
		>
			<div className="min-h-0 flex-1 overflow-hidden">
				<TopicPageDesktopSkeleton enableSidebarCollapse={false} />
			</div>
		</div>
	)
}

export default ChatProjectPageDesktopSkeleton
