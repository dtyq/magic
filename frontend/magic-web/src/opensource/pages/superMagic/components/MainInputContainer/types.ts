import { TopicMode } from "../../pages/Workspace/types"
import { SceneEditorContext, SceneEditorNodes } from "./components/editors/types"

export interface AgentInputContainerProps {
	mode?: TopicMode
	className?: string
	onRoleChange?: (mode: TopicMode) => void
	onSend?: (content: string) => void
}

export interface QuickActionButton {
	icon: React.ComponentType<{ className?: string }>
	label: string
	onClick?: () => void
}

export interface ToolIcon {
	id: string
	label: string
	icon: string
}
/**
 * 场景面板组件基础属性
 * @param editorContext - 编辑器上下文
 * @param editorNodes - 编辑器节点
 */
export interface ScenePanelComponentBaseProps {
	editorContext?: SceneEditorContext
	editorNodes?: SceneEditorNodes
}
