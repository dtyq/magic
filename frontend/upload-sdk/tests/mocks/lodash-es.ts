/**
 * Lodash ES Mock 文件
 * 为测试环境提供 lodash-es 的常用方法
 */

import * as lodash from "lodash-es"

// 定义throttle和debounce的类型
type ThrottleFunction = <T extends (...args: any[]) => any>(
	func: T,
	wait?: number,
	options?: lodash.ThrottleSettings,
) => lodash.DebouncedFunc<T>

type DebounceFunction = <T extends (...args: any[]) => any>(
	func: T,
	wait?: number,
	options?: lodash.DebounceSettings,
) => lodash.DebouncedFunc<T>

// 创建一个包含我们自定义方法的对象
const customMethods: {
	isFunction: (val: any) => boolean
	isObject: (val: any) => boolean
	isArray: (val: any) => boolean
	isString: (val: any) => boolean
	isNumber: (val: any) => boolean
	isBoolean: (val: any) => boolean
	isNull: (val: any) => boolean
	isUndefined: (val: any) => boolean
	isNil: (val: any) => boolean
	isEmpty: (val: any) => boolean
	get: (obj: any, path: string | string[], defaultValue?: any) => any
	omit: (obj: object, paths: string | string[]) => object
	pick: (obj: object, paths: string | string[]) => object
	merge: typeof lodash.merge
	cloneDeep: typeof lodash.cloneDeep
	throttle: ThrottleFunction
	debounce: DebounceFunction
} = {
	isFunction: (val: any): boolean => typeof val === "function",
	isObject: (val: any): boolean => val !== null && typeof val === "object",
	isArray: Array.isArray,
	isString: (val: any): boolean => typeof val === "string",
	isNumber: (val: any): boolean => typeof val === "number",
	isBoolean: (val: any): boolean => typeof val === "boolean",
	isNull: (val: any): boolean => val === null,
	isUndefined: (val: any): boolean => val === undefined,
	isNil: (val: any): boolean => val === null || val === undefined,
	isEmpty: (val: any): boolean => {
		if (val === null || val === undefined) return true
		if (Array.isArray(val) || typeof val === "string") return val.length === 0
		if (typeof val === "object") return Object.keys(val).length === 0
		return false
	},
	get: (obj: any, path: string | string[], defaultValue?: any): any => {
		if (obj == null) return defaultValue

		const pathArray = Array.isArray(path) ? path : path.split ? path.split(".") : [path]

		let result = obj
		for (const key of pathArray) {
			result = result?.[key]
			if (result === undefined) return defaultValue
		}

		return result
	},
	omit: (obj: object, paths: string | string[]): object => {
		if (!obj) return {}
		const pathArray = Array.isArray(paths) ? paths : [paths]
		const result = { ...obj }
		pathArray.forEach((path) => {
			delete (result as any)[path]
		})
		return result
	},
	pick: (obj: object, paths: string | string[]): object => {
		if (!obj) return {}
		const pathArray = Array.isArray(paths) ? paths : [paths]
		const result: Record<string, any> = {}
		pathArray.forEach((path) => {
			if ((obj as any)[path] !== undefined) {
				result[path] = (obj as any)[path]
			}
		})
		return result
	},
	// 使用lodash原始方法
	merge: lodash.merge,
	cloneDeep: lodash.cloneDeep,
	throttle: lodash.throttle,
	debounce: lodash.debounce,
}

// 从自定义方法对象中导出各个方法
export const {
	isFunction,
	isObject,
	isArray,
	isString,
	isNumber,
	isBoolean,
	isNull,
	isUndefined,
	isNil,
	isEmpty,
	get,
	omit,
	pick,
	merge,
	cloneDeep,
	throttle,
	debounce,
} = customMethods

// 默认导出我们的自定义方法，而不是整个lodash
export default customMethods
