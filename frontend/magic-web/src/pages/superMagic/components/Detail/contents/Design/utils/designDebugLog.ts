/**
 * 设计模块轻量调试日志：仅在开发环境输出，避免线上裸 catch 完全不可观测。
 */
export function designDebugLog(scope: string, payload: unknown): void {
	// if (true) return
	// eslint-disable-next-line no-console
	// console.log(`[SuperMagic:Design:${scope}]`, payload)
}
