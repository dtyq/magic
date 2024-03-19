import { isPlainObject } from "lodash-es"

/**
 * 无需手动清理的空闲回调执行函数
 * @param callback 待执行的回调函数
 */
export function requestIdleCallback(callback: () => void): void {
	if (window?.requestIdleCallback) {
		window.requestIdleCallback(callback, { timeout: 2000 })
		return
	}

	setTimeout(callback, 0)
}

/**
 * 深度遍历处理对象中的所有值
 * @param obj 待处理的对象
 * @param handler 处理函数，用于转换特定类型的值
 * @returns 处理后的新对象
 */
export function deepProcessObject<T = any>(obj: T, handler: (value: any) => any): T {
	// 处理数组（必须在 Object 检查之前，因为数组也是对象）
	if (Array.isArray(obj)) {
		return obj.map((item) => deepProcessObject(item, handler)) as T
	}

	// 处理普通对象
	if (isPlainObject(obj)) {
		const result: Record<string, any> = {}
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				result[key] = deepProcessObject((obj as any)[key], handler)
			}
		}
		return result as T
	}

	// 其他类型的对象（如 Map, Set 等）直接返回
	return handler(obj)
}
