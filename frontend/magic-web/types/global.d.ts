/**
 * View Transition API 全局类型声明
 *
 * View Transition API 是一个相对较新的 Web API，
 * 用于在页面状态变化时创建平滑的视觉过渡效果。
 *
 * 浏览器支持：
 * - Chrome 111+
 * - Edge 111+
 * - Safari 18+
 * - Firefox: 暂不支持
 */

interface ViewTransition {
	/**
	 * 过渡准备完成的 Promise
	 * 当过渡动画准备开始时解析
	 */
	readonly ready: Promise<void>

	/**
	 * 更新回调完成的 Promise
	 * 当传递给 startViewTransition 的回调函数完成时解析
	 */
	readonly updateCallbackDone: Promise<void>

	/**
	 * 过渡完成的 Promise
	 * 当整个过渡动画完成时解析
	 */
	readonly finished: Promise<void>

	/**
	 * 跳过过渡动画
	 * 立即完成过渡，跳过动画效果
	 */
	skipTransition(): void
}

interface Document {
	/**
	 * 启动 View Transition
	 *
	 * @param updateCallback - 更新 DOM 的回调函数
	 * @returns ViewTransition 实例，如果浏览器不支持则返回 undefined
	 *
	 * @example
	 * ```typescript
	 * const transition = document.startViewTransition(() => {
	 *   // 更新 DOM 状态
	 *   updatePageContent()
	 * })
	 *
	 * // 等待过渡完成
	 * await transition.finished
	 * ```
	 */
	startViewTransition?(updateCallback?: () => void | Promise<void>): ViewTransition
}

/**
 * CSS 属性扩展
 * 添加 view-transition-name 属性支持
 */
declare module "react" {
	interface CSSProperties {
		/**
		 * CSS view-transition-name 属性
		 * 用于标识参与 View Transition 的元素
		 */
		viewTransitionName?: string
	}
}

/**
 * 全局 CSS 变量类型扩展
 */
declare global {
	interface CSSStyleDeclaration {
		viewTransitionName: string
	}

	/**
	 * Array.prototype.at polyfill 类型声明
	 * 支持使用负索引访问数组元素
	 */
	interface Array<T> {
		at(index: number): T | undefined
	}

	/**
	 * Array.prototype.findLast polyfill 类型声明
	 * 从数组末尾开始查找满足条件的第一个元素
	 */
	interface Array<T> {
		findLast<S extends T>(
			predicate: (value: T, index: number, array: T[]) => value is S,
			thisArg?: any,
		): S | undefined
		findLast(
			predicate: (value: T, index: number, array: T[]) => boolean,
			thisArg?: any,
		): T | undefined
	}

	/**
	 * Array.prototype.findLastIndex polyfill 类型声明
	 * 从数组末尾开始查找满足条件的第一个元素的索引
	 */
	interface Array<T> {
		findLastIndex(
			predicate: (value: T, index: number, array: T[]) => boolean,
			thisArg?: any,
		): number
	}

	/**
	 * String.prototype.at polyfill 类型声明
	 * 支持使用负索引访问字符串字符
	 */
	interface String {
		at(index: number): string | undefined
	}

	/**
	 * String.prototype.replaceAll polyfill 类型声明
	 * 替换字符串中所有匹配的子字符串或正则表达式
	 */
	interface String {
		replaceAll(
			searchValue: string | RegExp,
			replaceValue: string | ((substring: string, ...args: any[]) => string),
		): string
	}

	/**
	 * Window interface extension for VoiceClient debug methods
	 */
	interface Window {
		/**
		 * Debug utilities for VoiceClient packet logging
		 */
		voiceClientDebug?: {
			/**
			 * Export packet logs for a specific connection
			 * @param connectionId - The connection ID to export logs for
			 */
			exportPacketLogs: (connectionId: string) => void
			/**
			 * Toggle packet logging to IndexedDB
			 * @param enabled - Whether to enable or disable packet logging
			 */
			setPacketLoggingEnabled: (enabled: boolean) => void
		}

		/**
		 * Export packet logs for a specific connection
		 * @deprecated Use window.voiceClientDebug.exportPacketLogs instead
		 * @param connectionId - The connection ID to export logs for
		 */
		exportPacketLogs?: (connectionId: string) => void

		/**
		 * Toggle packet logging to IndexedDB
		 * @deprecated Use window.voiceClientDebug.setPacketLoggingEnabled instead
		 * @param enabled - Whether to enable or disable packet logging
		 */
		setPacketLoggingEnabled?: (enabled: boolean) => void
	}
}

export {}
