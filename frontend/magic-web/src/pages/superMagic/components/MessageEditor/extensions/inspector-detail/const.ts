export const INSPECTOR_DETAIL_TYPE = "inspector-detail"

/**
 * Collapsed chip stays compact in the editor and message bubbles.
 *
 * 上限必须是「容器宽 - 标签自身的左右外边距」：标签自带 `mx-1`（编辑器 `mx-0.5`），
 * `max-width:100%` 不含外边距，标签在窄容器里会连边距一起撑出去 4px。裁剪预览的
 * 折叠盒（overflow:hidden）正好在那里切一刀，右侧边框与圆角就整条消失。留出 8px
 * 后行内盒与其边距都能落在裁剪边界内；容器宽于 228px 时仍是 220px，宽场景无变化。
 */
export const INSPECTOR_DETAIL_COLLAPSED_MAX_WIDTH_CLASS = "max-w-[min(220px,calc(100%_-_8px))]"

/**
 * Invisible marker character (U+2063, invisible separator) prepended to the
 * inspector title paragraph. Used by renderers to detect inspector content
 * blocks in plain-text messages and render them as collapsible panels.
 */
export const INSPECTOR_DETAIL_MARKER = "\u2063"

/** Invisible suffix used to persist captureId without a visible prompt line. */
export const INSPECTOR_CAPTURE_ID_MARKER = `${INSPECTOR_DETAIL_MARKER}\u2064`
