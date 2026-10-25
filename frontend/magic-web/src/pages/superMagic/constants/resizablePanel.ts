/**
 * Resizable Panel 相关常量
 */

/**
 * 项目侧边栏宽度的 localStorage key
 * 用于 TopicPage, ProjectPage, SharePage
 */
export const PROJECT_SIDER_WIDTH_STORAGE_KEY = "MAGIC:supermagic-project-sider-width"

/**
 * 消息面板宽度的 localStorage key
 * 用于 TopicPage, SharePage
 */
export const MESSAGE_PANEL_WIDTH_STORAGE_KEY = "MAGIC:supermagic-message-panel-width"

/**
 * 默认最小宽度
 */
export const DEFAULT_MIN_WIDTH = {
	PROJECT_SIDER: 240,
	MESSAGE_PANEL: 360,
}

/**
 * 默认最大宽度
 */
export const DEFAULT_MAX_WIDTH = {
	PROJECT_SIDER: 600,
	MESSAGE_PANEL: 768,
}

/**
 * 默认宽度
 */
export const DEFAULT_WIDTH = {
	PROJECT_SIDER: 320,
	MESSAGE_PANEL: 420,
}

/**
 * 低分辨率布局断点：首次打开 Topic 页面时，优先为中间工作区保留可用空间。
 */
export const LOW_RESOLUTION_VIEWPORT_WIDTH_PX = 1280

/**
 * Resize handle 的统一宽度
 */
export const RESIZABLE_PANEL_HANDLE_WIDTH = 8

/**
 * 历史话题面板的固定宽度
 */
export const TOPIC_HISTORY_PANEL_WIDTH = 256

/**
 * 历史话题固定态下允许保留的最小详情区宽度
 */
export const MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY = 688

/**
 * 历史话题固定态所需的最小中间容器宽度
 */
export const FIXED_TOPIC_HISTORY_REQUIRED_WIDTH =
	MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY +
	DEFAULT_MIN_WIDTH.MESSAGE_PANEL +
	TOPIC_HISTORY_PANEL_WIDTH +
	RESIZABLE_PANEL_HANDLE_WIDTH

export const SIDEBAR_TRANSITION_MS = 220
export const PROJECT_SIDER_PANEL_STORAGE_KEY = "supermagic-project-sider-panel"
/** 对话页文件栏的收起偏好，与项目页分开保存，避免互相覆盖。 */
export const CHAT_PROJECT_SIDER_PANEL_STORAGE_KEY = "supermagic-chat-sider-panel"
export const TOPIC_HISTORY_RESIZE = { min: 240, default: 256, max: 480 } as const
