/** 与 CrewEditPanels `panelResizeTransition` 中非拖拽态一致的宽度/透明度过渡 */
export const KNOWLEDGE_DETAIL_PANEL_WIDTH_TRANSITION =
	"width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease"

/** 原文预览分栏：额外过渡右侧边框宽度 */
export const KNOWLEDGE_ORIGINAL_PREVIEW_SPLIT_TRANSITION = `${KNOWLEDGE_DETAIL_PANEL_WIDTH_TRANSITION}, border-right-width 300ms cubic-bezier(0.4, 0, 0.2, 1)`
