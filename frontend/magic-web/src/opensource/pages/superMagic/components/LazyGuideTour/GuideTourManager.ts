import { platformKey } from "@/opensource/utils/storage"
import { WorkspacePage } from "@/opensource/pages/superMagic/layouts/MainLayout/types"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"

export const GuideTourElementId = {
	Init: "tour-init",
	MessagePanel: "tour-message-panel",
	TopicModeTabs: "tour-topic-mode-tabs",
	ModelSelector: "tour-model-selector",
	MCPButton: "tour-mcp-button",
	UploadFileButton: "tour-upload-file-button",
	VoiceInputButton: "tour-voice-input-button",
	WorkspaceBreadcrumb: "tour-workspace-breadcrumb",
	ProjectFileSider: "tour-project-file-sider",
	MessageHeaderTopicGroup: "tour-message-header-topic-group",
	MessageEditorAtButton: "tour-message-editor-at-button",
}

const getWorkspaceGuideTourLocalStorageKey = (userMagicId?: string) => {
	return platformKey(`super_magic/is_need_workspace_features_guide/${userMagicId || "unknown"}`)
}

const getProjectGuideTourLocalStorageKey = (userMagicId?: string) => {
	return platformKey(`super_magic/is_need_project_features_guide/${userMagicId || "unknown"}`)
}

export const setNeedGuideTour = (userMagicId?: string) => {
	localStorage.setItem(getWorkspaceGuideTourLocalStorageKey(userMagicId), "true")
	localStorage.setItem(getProjectGuideTourLocalStorageKey(userMagicId), "true")
	pubsub.publish(PubSubEvents.GuideTourElementReady, GuideTourElementId.Init)
}

/**
 * 检查是否需要显示引导教程
 * 这个函数会在组件挂载前执行，避免不必要的组件初始化
 */
export function checkIfGuideTourNeeded(
	userMagicId?: string,
	workspacePage?: WorkspacePage,
	isMobile?: boolean,
): { needsGuide: boolean; guideType: "workspace" | "project" | null } {
	// 移动端不显示引导
	if (isMobile) {
		return { needsGuide: false, guideType: null }
	}

	const workspaceGuideTourLocalStorageKey = getWorkspaceGuideTourLocalStorageKey(userMagicId)
	const projectGuideTourLocalStorageKey = getProjectGuideTourLocalStorageKey(userMagicId)

	const isNeedWorkspaceFeaturesGuide =
		localStorage.getItem(workspaceGuideTourLocalStorageKey) === "true"
	const isNeedProjectFeaturesGuide =
		localStorage.getItem(projectGuideTourLocalStorageKey) === "true"

	// 第一次进入工作区首页的引导
	if (isNeedWorkspaceFeaturesGuide && workspacePage === WorkspacePage.Home) {
		return { needsGuide: true, guideType: "workspace" }
	}

	// 第一次进入项目话题页的引导
	if (isNeedProjectFeaturesGuide && workspacePage === WorkspacePage.Chat) {
		return { needsGuide: true, guideType: "project" }
	}

	return { needsGuide: false, guideType: null }
}

/**
 * 标记引导教程为已完成
 */
export function markGuideTourCompleted(userMagicId?: string, guideType?: "workspace" | "project") {
	if (guideType === "workspace") {
		const key = getWorkspaceGuideTourLocalStorageKey(userMagicId)
		localStorage.setItem(key, "false")
	} else if (guideType === "project") {
		const key = getProjectGuideTourLocalStorageKey(userMagicId)
		localStorage.setItem(key, "false")
	}
}
