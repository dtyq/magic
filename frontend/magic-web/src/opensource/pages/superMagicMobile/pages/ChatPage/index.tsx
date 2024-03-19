import { useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useModeList } from "@/opensource/pages/superMagic/components/MessagePanel/hooks/usePatternTabs"
import ChatPageHeader from "./components/ChatPageHeader"
import SloganSection from "./components/SloganSection"
import CrewGrid from "./components/CrewGrid"
import ChatDrawer from "./components/ChatDrawer"
import HierarchicalWorkspacePopup from "@/opensource/pages/superMagicMobile/components/HierarchicalWorkspacePopup"
import type { HierarchicalWorkspacePopupRef } from "@/opensource/pages/superMagicMobile/components/HierarchicalWorkspacePopup/types"
import { useMemoizedFn } from "ahooks"
import { ModeItem, TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { roleStore } from "@/opensource/pages/superMagic/stores/RoleStore"
import MobileInputContainer, {
	type MobileInputContainerRef,
} from "./components/MobileInputContainer"
import { MOBILE_LAYOUT_CONFIG } from "@/opensource/pages/superMagic/components/MainInputContainer/components/editors/constant"
import { topicStore, projectStore, workspaceStore } from "@/opensource/pages/superMagic/stores/core"
import { SceneEditorContext } from "@/opensource/pages/superMagic/components/MainInputContainer/components/editors/types"
import SuperMagicService from "@/opensource/pages/superMagic/services"

const ChatPage = observer(() => {
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
				<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden py-20">
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
