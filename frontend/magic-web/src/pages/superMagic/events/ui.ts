/**
 * 退出全屏模式时通知相关组件重置布局。无参数。
 */
export type SuperMagicExitFullscreenArgs = []

/**
 * 将文件详情区切换到最大化（全屏覆盖）状态。无参数。
 */
export type SuperMagicMaximizeFileArgs = []

/**
 * 切换详情面板的展示模式。
 * "files" 表示多文件列表视图，"single" 表示单文件详情视图。
 * 注：当前订阅侧已清除，publish 侧保留以备后续恢复。
 */
export type SuperMagicSwitchDetailModeArgs = [mode: "files" | "single"]

/**
 * 通知 AgentSelector 刷新 Agent 候选列表。无参数。
 */
export type SuperMagicUpdateAgentsArgs = []

/**
 * 分享页文件夹被点击时发布，触发相关折叠/展开逻辑。无参数。
 */
export type SuperMagicFolderClickArgs = []
