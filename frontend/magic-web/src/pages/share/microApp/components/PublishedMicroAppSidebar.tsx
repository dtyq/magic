import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from "react"
import { observer } from "mobx-react-lite"
import { Files, MessageSquare, PanelRightClose, Timer } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"
import IconShareCog from "@/enhance/tabler/icons-react/icons/iconShareCog"
import AppConversationPanel from "@/pages/superMagic/pages/MicroAppPage/components/AppConversationPanel"
import UserSpaceIcon from "@/pages/superMagic/components/UserSpace/UserSpaceIcon"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/utils/cn"
import PublishedMicroAppAttachmentsPanel from "./PublishedMicroAppAttachmentsPanel"

const ScheduledTasksPanel = lazy(
	() =>
		import("@/pages/superMagic/pages/MicroAppPage/components/MicroAppScheduledTasksPanel/MicroAppScheduledTasksPanel"),
)
const UserSpacePanel = lazy(() => import("@/pages/superMagic/components/UserSpace/UserSpacePanel"))
const ShareManagementPanel = lazy(
	() => import("@/pages/superMagic/components/ShareManagement/ShareManagementPanel"),
)

export type PublishedMicroAppPanel =
	"conversation" | "attachments" | "tasks" | "userSpace" | "share"

interface Props extends ComponentProps<typeof AppConversationPanel> {
	panel: PublishedMicroAppPanel
	onPanelChange: (panel: PublishedMicroAppPanel) => void
	appId: string
	appName?: string
	ensureProject: () => Promise<unknown>
	onCloseHistory: () => void
	onOpenPreview: (detail: unknown) => void
}

const PublishedMicroAppSidebar = observer(function PublishedMicroAppSidebar({
	panel,
	onPanelChange,
	appId,
	appName,
	ensureProject,
	onCloseHistory,
	onOpenPreview,
	...conversationProps
}: Props) {
	const { t } = useTranslation("super")
	const [failed, setFailed] = useState(false)
	const pending = useRef(false)
	const requestId = useRef(0)
	const {
		selectedProject,
		projectFilesStore,
		isConversationPanelCollapsed: collapsed,
		onExpandConversationPanel,
		onToggleConversationPanel,
	} = conversationProps

	useEffect(() => {
		// Iframe sends already expand the layout; show the messages even when another panel is selected.
		const showConversation = () => onPanelChange("conversation")
		pubsub.subscribe(PubSubEvents.Expand_Topic_Conversation_Panel, showConversation)
		return () => {
			requestId.current += 1
			pubsub.unsubscribe(PubSubEvents.Expand_Topic_Conversation_Panel, showConversation)
		}
	}, [onPanelChange])

	async function loadProject() {
		if (pending.current || selectedProject) return
		pending.current = true
		const id = ++requestId.current
		setFailed(false)
		try {
			await ensureProject()
		} catch {
			if (id === requestId.current) setFailed(true)
		} finally {
			if (id === requestId.current) pending.current = false
		}
	}

	function selectPanel(next: PublishedMicroAppPanel) {
		onPanelChange(next)
		onCloseHistory()
		onExpandConversationPanel?.()
		void loadProject()
	}

	const entries = [
		{
			value: "conversation" as const,
			label: t("microAppPage.conversation.title"),
			icon: MessageSquare,
		},
		{ value: "attachments" as const, label: t("attachmentList.projectFiles"), icon: Files },
		{ value: "tasks" as const, label: t("scheduleTask.title"), icon: Timer },
		{
			value: "userSpace" as const,
			label: t("userSpace.title"),
			icon: UserSpaceIcon,
			testId: "published-micro-app-user-space-button",
		},
		{
			value: "share" as const,
			label: t("shareManagement.title"),
			icon: IconShareCog,
			testId: "published-micro-app-share-button",
		},
	]
	const navigation = (collapsed ? entries.slice(1) : entries).map(
		({ value, label, icon: Icon, testId }) => (
			<MagicTooltip key={value} title={label}>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={label}
					aria-pressed={!collapsed && panel === value}
					className={cn(
						"shrink-0 text-foreground",
						collapsed && "!size-8 !min-h-8 !min-w-8 !rounded-md !p-0",
						!collapsed && panel === value && "bg-accent text-accent-foreground",
					)}
					onClick={() => selectPanel(value)}
					data-testid={testId ?? `published-micro-app-${value}-button`}
				>
					<span className="flex size-4 shrink-0 items-center justify-center">
						<Icon size={16} color="currentColor" aria-hidden />
					</span>
				</Button>
			</MagicTooltip>
		),
	)
	const loading = (
		<div
			role="status"
			className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground"
		>
			{t("scheduleTask.contextLoading")}
		</div>
	)

	return (
		<aside
			className={cn(
				"flex h-full min-h-0 flex-col",
				// Keep 32px icons; the 40px rail only trims leftover horizontal padding.
				collapsed
					? "bg-sidebar [--conversation-header-button-size:32px] [--conversation-header-gap:8px] [--conversation-header-padding:8px]"
					: "bg-background",
			)}
			data-testid="published-micro-app-conversation-panel"
		>
			{!collapsed && (
				<div
					className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
					data-testid="published-micro-app-conversation-header"
				>
					{/* Chrome title is conversation-only; others title themselves. */}
					{panel === "conversation" ? (
						<span className="min-w-0 truncate text-sm font-medium">
							{t("microAppPage.conversation.title")}
						</span>
					) : (
						<span className="min-w-0 flex-1" />
					)}
					<div className="flex shrink-0 items-center gap-1">
						{navigation}
						<MagicTooltip title={t("microAppPage.conversation.collapse")}>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t("microAppPage.conversation.collapse")}
								onClick={onToggleConversationPanel}
							>
								<PanelRightClose size={16} aria-hidden />
							</Button>
						</MagicTooltip>
					</div>
				</div>
			)}
			{/* Keep the editor mounted across panel switches so drafts and message state survive. */}
			<div
				hidden={!collapsed && (panel !== "conversation" || !selectedProject)}
				className="min-h-0 flex-1"
			>
				<AppConversationPanel
					{...conversationProps}
					lockToMicroAppMode={false}
					microAppId={appId}
					microAppName={appName}
					onExpandConversationPanel={() => selectPanel("conversation")}
					onToggleConversationPanel={
						collapsed ? () => selectPanel("conversation") : onToggleConversationPanel
					}
					hideConversationPanelToggle={!collapsed}
					trailingActions={
						collapsed ? (
							<div className="flex flex-col items-center gap-2">{navigation}</div>
						) : undefined
					}
				/>
			</div>
			{!collapsed &&
				(!selectedProject ? (
					<div className="min-h-0 flex-1">
						{failed ? (
							<div
								role="alert"
								className="flex h-full flex-col items-center justify-center gap-3 p-4 text-sm"
							>
								<p>{t("microAppPage.conversation.loadFailed")}</p>
								<Button variant="outline" onClick={() => void loadProject()}>
									{t("common.retry")}
								</Button>
							</div>
						) : (
							loading
						)}
					</div>
				) : panel === "attachments" ? (
					<PublishedMicroAppAttachmentsPanel
						attachments={projectFilesStore.workspaceFileTree}
						projectId={selectedProject.id}
						selectedProject={selectedProject}
						selectedTopic={conversationProps.topicStore.selectedTopic}
						setUserSelectDetail={onOpenPreview}
						onFileClick={conversationProps.onFileClick}
					/>
				) : panel === "tasks" ? (
					<div
						className="min-h-0 flex-1 pt-1"
						data-testid="published-micro-app-tasks-panel"
					>
						<Suspense fallback={loading}>
							<ScheduledTasksPanel
								key={selectedProject.id}
								selectWorkspaceId={selectedProject.workspace_id}
								selectProjectId={selectedProject.id}
								workspaceName={selectedProject.workspace_name}
								projectName={selectedProject.project_name}
								microAppId={appId}
								microAppName={appName}
								compact
							/>
						</Suspense>
					</div>
				) : panel === "userSpace" ? (
					<div
						className="min-h-0 flex-1 pt-2"
						data-testid="published-micro-app-user-space-panel"
					>
						<Suspense fallback={loading}>
							<UserSpacePanel
								projectId={selectedProject.id}
								projectName={selectedProject.project_name}
								topicId={conversationProps.topicStore.selectedTopic?.id}
								onFileClick={conversationProps.onFileClick}
							/>
						</Suspense>
					</div>
				) : panel === "share" ? (
					<div
						className="min-h-0 flex-1 pt-2"
						data-testid="published-micro-app-share-panel"
					>
						<Suspense fallback={loading}>
							<ShareManagementPanel projectId={selectedProject.id} />
						</Suspense>
					</div>
				) : null)}
		</aside>
	)
})

export default PublishedMicroAppSidebar
