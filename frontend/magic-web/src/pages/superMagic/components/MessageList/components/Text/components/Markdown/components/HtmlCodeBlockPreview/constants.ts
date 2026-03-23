// HTML 代码块桌面预览的默认可视高度上限。
export const HTML_CODE_BLOCK_PREVIEW_DESKTOP_HEIGHT = 560

// 在未拿到真实内容宽度前，预览画布使用的基础宽度。
export const HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH = 1200

// 在窄容器里用于推导预览视口高度的宽高比。
export const HTML_CODE_BLOCK_PREVIEW_HEIGHT_TO_WIDTH_RATIO = 4 / 2

// 根据内容中的宽度线索做启发式推导时，可选择的几档画布宽度。
export const HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES = [
	1200, 1440, 1600, 1920,
] as const

// 预览缩放的最低可读阈值，避免内容被压得过小。
export const HTML_CODE_BLOCK_PREVIEW_MIN_READABLE_SCALE = 0.5

// 内容尺寸变化低于这个阈值时，认为没有必要刷新预览布局，减少抖动。
export const HTML_CODE_BLOCK_PREVIEW_CONTENT_METRICS_THRESHOLD = 16

// 只有当内容高度比基础视口明显更小时，才真正收缩卡片高度。
export const HTML_CODE_BLOCK_PREVIEW_HEIGHT_SHRINK_THRESHOLD = 24

// 复制成功态在 Header 中保持的时长。
export const HTML_CODE_BLOCK_PREVIEW_COPY_FEEDBACK_DURATION = 1500

// 预览骨架屏最短显示时间，避免闪一下就消失造成视觉抖动。
export const HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION = 140

// 在预览 iframe 内部开启 overscroll contain，避免滚轮穿透到外层消息列表。
export const HTML_CODE_BLOCK_PREVIEW_CONTAIN_IFRAME_OVERSCROLL = true

// 代码块桌面预览不依赖真实项目文件映射，因此传空 Map 即可。
export const HTML_CODE_BLOCK_PREVIEW_EMPTY_FILE_PATH_MAPPING = new Map<string, string>()

// 预览态里的链接点击当前不需要打开业务新标签页，这里提供一个空实现占位。
export function HTML_CODE_BLOCK_PREVIEW_OPEN_NEW_TAB_NOOP(...args: [string, string, boolean?]) {
	void args
	return undefined
}
