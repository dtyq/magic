import { useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Box, ChevronsUpDown } from "lucide-react"
import { useModeList } from "@/pages/superMagic/components/MessagePanel/hooks/usePatternTabs"
import ChatPageHeader from "./components/ChatPageHeader"
import SloganSection from "./components/SloganSection"
import CrewGrid from "./components/CrewGrid"
import ChatDrawer from "./components/ChatDrawer"
import HierarchicalWorkspacePopup from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup"
import type { HierarchicalWorkspacePopupRef } from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/types"
import { useMemoizedFn } from "ahooks"
import { ModeItem, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"
import MobileInputContainer, {
	type MobileInputContainerRef,
} from "./components/MobileInputContainer"
import { MOBILE_LAYOUT_CONFIG } from "@/pages/superMagic/components/MainInputContainer/components/editors/constant"
import { topicStore, projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import SuperMagicService from "@/pages/superMagic/services"
import { useTranslation } from "react-i18next"

const ChatPage = observer(() => {
	const { t } = useTranslation(["super", "sidebar"])
	const [drawerOpen, setDrawerOpen] = useState(false)
	const hierarchicalWorkspacePopupRef = useRef<HierarchicalWorkspacePopupRef>(null)
	const mobileInputContainerRef = useRef<MobileInputContainerRef>(null)

	const { modeList } = useModeList({ includeGeneral: true, includeChat: true })

	const currentRole = roleStore.currentRole

	const handleCrewSelect = useMemoizedFn((mode: ModeItem) => {
		roleStore.setCurrentRole(mode.mode.identifier as TopicMode)
	})

	// 默认选中第一个 mode
	useEffect(() => {
		if (modeList.length > 0 && !currentRole) {
			handleCrewSelect(modeList[0])
		}
	}, [modeList, currentRole, handleCrewSelect])

	// editor state
	const selectedTopic = topicStore.selectedTopic
	const selectedProject = projectStore.selectedProject
	const selectedWorkspace = workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace
	const displayWorkspaceName = selectedWorkspace?.name || t("super:workspace.unnamedWorkspace")
	const editorContext = useMemo<SceneEditorContext>(
		() => ({
			selectedTopic,
			selectedProject,
			selectedWorkspace,
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedProject: projectStore.setSelectedProject,
			topicMode: currentRole,
			setTopicMode: roleStore.setCurrentRole,
			topicExamplesMode: currentRole,
			layoutConfig: MOBILE_LAYOUT_CONFIG,
			onSendSuccess: ({ currentProject, currentTopic }) => {
				if (!selectedWorkspace || !currentProject || !currentTopic) return
				mobileInputContainerRef.current?.closeRealInput()
				SuperMagicService.switchTopic(currentTopic)
			},
			autoFocus: true,
		}),
		[currentRole, selectedTopic, selectedProject, selectedWorkspace],
	)

	return (
		<>
			<div className="flex size-full flex-col items-start bg-sidebar pb-safe-bottom-with-tabbar">
				{/* 头部 */}
				<ChatPageHeader onMenuClick={() => setDrawerOpen(true)} />

				{/* 主内容区域 */}
				<div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden py-20">
					<button
						type="button"
						className="absolute left-2.5 top-2.5 z-10 flex h-8 max-w-[calc(100%-20px)] items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent active:bg-accent/80"
						onClick={() => setDrawerOpen(true)}
						aria-label={`${t("super:workspace.workspaces")} / ${displayWorkspaceName}`}
						data-testid="chat-page-workspace-button"
					>
						<Box size={16} strokeWidth={1.5} className="shrink-0" />
						<span className="truncate">
							{t("super:workspace.workspaces")} / {displayWorkspaceName}
						</span>
						<ChevronsUpDown size={16} strokeWidth={1.5} className="shrink-0" />
					</button>
					<div className="flex max-h-full w-full flex-col items-center">
						{/* 标语区域 */}
						<SloganSection />

						{/* 角色选择网格 */}
						<CrewGrid
							crews={modeList}
							selectedCrew={currentRole}
							onSelectCrew={handleCrewSelect}
						/>
					</div>
				</div>
				{/* 输入框 */}
				<MobileInputContainer ref={mobileInputContainerRef} editorContext={editorContext} />
			</div>

			{/* 侧边栏 */}
			<ChatDrawer
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				hierarchicalWorkspacePopupRef={hierarchicalWorkspacePopupRef}
			/>

			{/* 工作区/项目选择弹窗 */}
			<HierarchicalWorkspacePopup ref={hierarchicalWorkspacePopupRef} />
		</>
	)
})

export default ChatPage
