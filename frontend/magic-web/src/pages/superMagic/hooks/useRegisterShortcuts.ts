import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { WorkspacePage } from "@/pages/superMagic/layouts/MainLayout/types"
import { ShortcutActions } from "../components/ShortcutKeysList/constants"
import { useRegisterContext, useGlobalShortcuts, useRegisterShortcut } from "./useGlobalShortcuts"
import { TopicMode, Workspace } from "../pages/Workspace/types"
import { HandleCreateProjectParams } from "./useProjects"

/**
 * 注册快捷键
 * @param param0 {
 * 	workspacePage: WorkspacePage
 * 	selectedWorkspace: Workspace | null
 * 	handleStartAddProject: (params: HandleCreateProjectParams) => void
 * 	handleCreateTopic: () => void
 * }
 */
function useRegisterShortcuts({
	workspacePage,
	selectedWorkspace,
	handleStartAddProject,
	handleCreateTopic,
}: {
	workspacePage: WorkspacePage
	selectedWorkspace: Workspace | null
	handleStartAddProject: (params: HandleCreateProjectParams) => void
	handleCreateTopic: () => void
}) {
	/** 全局快捷键集成 */
	// 注册全局上下文
	useRegisterContext("currentPage", () => workspacePage)
	useRegisterContext("selectedWorkspace", () => selectedWorkspace)
	useRegisterContext(
		"createProject",
		() => () =>
			handleStartAddProject({
				projectMode: TopicMode.Empty,
			}),
	)
	useRegisterContext("createTopic", () => handleCreateTopic)

	useGlobalShortcuts({
		enabled: true,
		onShortcutExecuted: (action, keyCombo) => {
			console.log(`🔥 全局快捷键触发: ${action}, 键位: ${keyCombo}`)
		},
	})

	// 注册快捷键 - 新建项目
	useRegisterShortcut(ShortcutActions.CREATE_NEW_PROJECT, (context) => {
		const currentPage = context.currentPage as WorkspacePage
		const createProject = context.createProject
		if ([WorkspacePage.Home, WorkspacePage.Chat].includes(currentPage)) {
			createProject()
		}
	})

	// 注册快捷键 - 新建话题
	useRegisterShortcut(ShortcutActions.CREATE_NEW_TOPIC, (context) => {
		const currentPage = context.currentPage as WorkspacePage
		const createTopic = context.createTopic
		if ([WorkspacePage.Chat].includes(currentPage)) {
			createTopic()
		}
	})

	// 注册快捷键 - 打开MCP列表
	useRegisterShortcut(ShortcutActions.OPEN_MCP_CONFIG, (context) => {
		const currentPage = context.currentPage as WorkspacePage
		if ([WorkspacePage.Home, WorkspacePage.Chat].includes(currentPage)) {
			pubsub.publish(PubSubEvents.Open_MCP_Config)
		}
	})

	// 注册快捷键 - 打开语音输入
	useRegisterShortcut(ShortcutActions.TOGGLE_VOICE_INPUT, (context) => {
		const currentPage = context.currentPage as WorkspacePage
		if ([WorkspacePage.Home, WorkspacePage.Chat].includes(currentPage)) {
			pubsub.publish(PubSubEvents.Toggle_Voice_Input)
		}
	})
}

export default useRegisterShortcuts
