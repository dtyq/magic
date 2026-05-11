import type { TopicMode, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { ShareListRefreshType } from "@/pages/superMagic/components/ShareManagement/types"
import type { SuperMagicDetailPayload } from "./openPlaybackTab"

/**
 * 项目重命名完成后同步新名称到其他组件（如标题栏）。
 * 传入项目 ID 和新项目名称。
 */
export type SuperMagicUpdateProjectNameArgs = [projectId: string, projectName: string]

/**
 * 话题模式（普通 / 高级）切换后通知相关组件更新 UI 状态。
 * 传入新模式、所属工作区 ID、所属项目 ID。
 */
export interface SuperMagicTopicModeChangedPayload {
	mode: TopicMode
	workspaceId: string
	projectId: string
}

/**
 * 接收来自 App 分享页的话题模式配置。
 * 传入话题模式（可选）和 agent_code（可选），用于分享页初始化时同步模式。
 */
export interface SuperMagicReceiveSharedProjectModePayload {
	mode?: TopicMode
	agent_code?: string
}

/**
 * 详情区自动展示内容变更时发布，通知详情面板切换到新内容。
 * 当前与 Playback / detail 区共用最小 detail 结构，兼容 empty 状态和工具详情对象。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Update_Auto_Detail, {
 *   type: "empty",
 *   data: { text: "正在思考" },
 * })
 */
export type SuperMagicUpdateAutoDetailArgs = [detail: SuperMagicDetailPayload]

/**
 * 分享列表需要刷新时发布。
 * 传入刷新类型（ShareListRefreshType），用于区分是话题维度还是项目维度刷新。
 */
export type SuperMagicRefreshShareListArgs = [type: ShareListRefreshType]

/**
 * 新话题创建成功后通知话题列表追加一条记录。
 * 传入后端返回的完整 Topic 对象。
 */
export type SuperMagicAddTopicArgs = [newTopic: Topic]
