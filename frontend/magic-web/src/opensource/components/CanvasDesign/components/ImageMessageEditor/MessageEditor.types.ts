/**
 * MessageEditor 组件本地类型定义
 * 用于实现组件隔离，避免依赖外部类型
 */

/** @ 面板数据服务需实现的端口（CanvasDesign 内使用，不依赖 MentionPanel） */
export interface MentionDataServicePort {
	getDefaultItems(t?: unknown): unknown[]
	searchItems(query: string): unknown[]
	setLimitInfoGetter?(getter: (() => unknown) | undefined): void
	setRefreshHandler?(handler: (() => void) | undefined): void
	requestRefresh?(): void
}
