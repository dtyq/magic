/**
 * 引导步骤的 DOM 锚点挂载完成时通知引导系统。
 * 传入引导元素标识符（即组件上的 role / data-* 名称）。
 */
export type SuperMagicGuideTourElementReadyArgs = [element: string]

/**
 * HTML 文件内部的引导锚点挂载完成时通知引导系统。
 * 传入引导元素标识符。
 */
export type SuperMagicGuideTourHTMLElementReadyArgs = [element: string]
