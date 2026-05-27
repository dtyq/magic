import { observer } from "mobx-react-lite"
import { ChevronLeft, Ellipsis } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import { superMagicStore } from "@/pages/superMagic/stores"
import { usePoppinsFont } from "@/styles/font"
import useNavigate from "@/routes/hooks/useNavigate"
import MobileBrandHero from "@/pages/superMagicMobile/components/MobileBrandHero"
import TopicPage from "@/pages/superMagicMobile/pages/TopicPage"
import {
	getMobileTopicPageCapabilities,
	MobileTopicPageKind,
} from "@/pages/superMagicMobile/pages/shared/topicPageCapabilities"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useChatWorkspace } from "@/pages/superMagic/hooks/useChatWorkspace"
import SuperMagicService from "@/pages/superMagic/services"
import { useMemoizedFn } from "ahooks"
import type { SuperMagicCreateNewTopicPayload } from "@/pages/superMagic/events/message"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import ProjectTopicService from "@/services/superMagic/ProjectTopicService"

interface ChatProjectHeroHeaderProps {
	title: string
	subtitle: string
	onBack: () => void
	onOpenActions: () => void
}

/**
 * 对话详情页头部对齐首页的圆形按钮与双行标题节奏，同时保留返回与项目操作入口。
 */
function ChatProjectHeroHeader({
	title,
	subtitle,
	onBack,
	onOpenActions,
}: ChatProjectHeroHeaderProps) {
	const { t } = useTranslation(["common"])
	// Poppins 懒加载器当前只支持 300/400/600/900，这里使用 600 近似标题的中等字重。
	usePoppinsFont([400, 600])

	return (
		<header
			className="mobile-page-header relative flex items-center justify-between pb-0"
			data-testid="chat-project-hero-header"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="flex size-12 shrink-0 rounded-full bg-card text-foreground shadow-[0px_10px_30px_rgba(15,23,42,0.10)] active:scale-95"
				onClick={onBack}
				aria-label={t("back")}
				data-testid="chat-project-hero-back-button"
			>
				<ChevronLeft className="size-[22px]" />
			</Button>

			{/* 标题区域使用 flex 居中，避免 absolute 布局，保证在 header 内始终居中展示 */}
			<div className="flex min-w-0 flex-1 flex-col items-center justify-center px-3 pt-2 text-center">
				<h1 className="w-full truncate font-poppins text-[18px] font-medium leading-7 text-foreground">
					{title}
				</h1>
				<p className="w-full truncate font-poppins text-[14px] leading-5 text-muted-foreground">
					{subtitle}
				</p>
			</div>

			{/* 聊天详情页按原型收敛为单一“更多”入口，具体动作在底部 Action Sheet 中统一承载。 */}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="ml-auto flex size-12 shrink-0 rounded-full bg-card text-foreground shadow-[0px_10px_30px_rgba(15,23,42,0.10)] active:scale-95"
				onClick={onOpenActions}
				aria-label={t("more")}
				data-testid="chat-project-hero-more-button"
			>
				<Ellipsis className="size-[22px]" />
			</Button>
		</header>
	)
}

/**
 * 空态欢迎区直接复用首页文案与品牌图形，确保对话页在“无消息”时和首页保持同一视觉语言。
 */
function ChatProjectEmptyHero() {
	return (
		<div
			className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-[58%] justify-center px-6"
			data-testid="chat-project-empty-hero"
		>
			<MobileBrandHero imageClassName="size-[76px] rounded-[26px]" />
		</div>
	)
}

/**
 * 对话详情面板继续复用既有 TopicPage 消息与输入逻辑，只在空态时替换为首页化的视觉壳层。
 */
interface ChatProjectMessagePanelProps {
	onOpenActions: () => void
}

export const ChatProjectMessagePanel = observer(function ChatProjectMessagePanel({
	onOpenActions,
}: ChatProjectMessagePanelProps) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const [isInitialMessagesLoading, setIsInitialMessagesLoading] = useState(false)
	const [isInitialMessagesReady, setIsInitialMessagesReady] = useState(false)
	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic
	const capabilities = getMobileTopicPageCapabilities(MobileTopicPageKind.SingleTopicChat)
	// 空态直接订阅 MobX 消息 Map，确保 refreshState 异步补齐消息后能立刻退出欢迎壳层。
	const topicMessages = selectedTopic?.chat_topic_id
		? (superMagicStore.messages?.get(selectedTopic.chat_topic_id) ?? [])
		: []
	const isEmptyStatus =
		isInitialMessagesReady && topicMessages.length === 0 && !isInitialMessagesLoading

	useEffect(() => {
		// 切换会话后先回到过渡态，等首轮拉取明确返回“无消息”再展示欢迎空态。
		setIsInitialMessagesReady(false)
	}, [selectedTopic?.id])

	const { createProjectInChatWorkspace } = useChatWorkspace({ projectPageSize: 1 })

	/**
	 * 对话页切换专家时，不在当前项目内创建兄弟话题（单话题设计），
	 * 而是以目标专家模式创建一个全新对话并跳转，与首页「新建对话」行为一致。
	 * topicMode 由 Create_New_Topic payload 携带，不应为 undefined。
	 */
	const handleCreateNewChatOnExpertSwitch = useMemoizedFn(
		async (payload?: SuperMagicCreateNewTopicPayload) => {
			const targetMode = payload?.topicMode as TopicMode | undefined
			if (!targetMode) return
			const createdProject = await createProjectInChatWorkspace({ projectMode: targetMode })
			if (!createdProject?.project || !createdProject.topic) return

			// 服务端返回的新 topic 可能 topic_mode 为空，导致 useTopicMode 的 useDeepCompareEffect
			// 在切换后回落到全局"第一个模式"而非用户选中的专家。提前将目标模式写入本地缓存，
			// 确保 getProjectDefaultTopicMode(newProject) 能命中正确值。
			ProjectTopicService.setProjectDefaultTopicMode(
				createdProject.project.workspace_id,
				createdProject.project.id,
				targetMode,
			)

			// 不调用 switchChatProject（它会先更新 MobX store 再导航）：
			// switchChatProject 的更新顺序会让 ChatProjectPage.useEffect 在 URL 还未更新时
			// 检测到 "store=newProjectId ≠ url=oldProjectId"，触发错误的 refreshState(oldProjectId)，
			// 进而产生"空态 → 旧对话 → 新空态"三次闪动。
			// 改为仅导航，由 ChatProjectPage.useEffect → refreshState(newProjectId) 单次正确恢复状态。
			SuperMagicService.route.navigateToChatProject(
				createdProject.project,
				createdProject.topic.id,
			)
		},
	)

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Create_New_Topic, handleCreateNewChatOnExpertSwitch)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Create_New_Topic, handleCreateNewChatOnExpertSwitch)
		}
	}, [handleCreateNewChatOnExpertSwitch])

	/**
	 * Chat 详情页顶部优先展示当前会话名；仅当会话名缺失时才回退到项目名和未命名文案。
	 */
	const projectTitle =
		selectedTopic?.topic_name?.trim() ||
		selectedProject?.project_name?.trim() ||
		t("chat.unnamedChat")

	return (
		<div
			className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-sidebar"
			data-testid="chat-project-message-panel"
		>
			<ChatProjectHeroHeader
				title={projectTitle}
				subtitle={t("chatList.title")}
				onBack={() => {
					const fallback = capabilities.resolveBackTarget(selectedProject?.id)
					navigate({
						delta: -1,
						name: fallback.name,
						params: fallback.params,
						viewTransition: false,
					})
				}}
				onOpenActions={onOpenActions}
			/>
			<div className="relative min-h-0 flex-1 overflow-hidden">
				{isEmptyStatus ? <ChatProjectEmptyHero /> : null}
				<TopicPage
					className="min-h-0 flex-1"
					hideHeader
					hideTopicActions
					pageKind={MobileTopicPageKind.SingleTopicChat}
					onInitialMessagesLoadingChange={setIsInitialMessagesLoading}
					onInitialMessagesReadyChange={setIsInitialMessagesReady}
					messageListFallbackRender={<div className="h-full w-full" />}
					messageListClassName={
						isEmptyStatus ? "pointer-events-none opacity-0" : undefined
					}
					bodyClassName={isEmptyStatus ? "bg-transparent" : undefined}
					footerClassName={isEmptyStatus ? "bg-transparent" : undefined}
					footerInnerClassName={
						isEmptyStatus ? "pointer-events-auto mt-auto gap-3" : undefined
					}
				/>
			</div>
		</div>
	)
})
