import { useState, useEffect, useRef, useCallback } from "react"
import type { FormInstance } from "antd"
import { Form } from "antd"
import { isEqual } from "lodash-es"

export interface UseFormChangeDetectionOptions {
	/**
	 * 是否启用变更检测
	 * @default true
	 */
	enabled?: boolean
	/**
	 * 自定义比较函数，用于深度比较两个值
	 * @default lodash-es的isEqual
	 */
	compareFn?: (a: any, b: any) => boolean
	/**
	 * 要监听的特定字段路径数组，为空则监听所有字段
	 * @default [] (监听所有字段)
	 */
	watchFields?: string[]
	/**
	 * 是否忽略某些字段的变更
	 * @default []
	 */
	ignoreFields?: string[]
	/**
	 * 变更检测的防抖延迟（毫秒）
	 * @default 300
	 */
	debounceDelay?: number
}

export interface UseFormChangeDetectionResult {
	/**
	 * 表单是否有未保存的更改
	 */
	hasChanges: boolean
	/**
	 * 重置变更检测状态
	 */
	resetChangeDetection: () => void
	/**
	 * 手动设置变更状态
	 */
	setHasChanges: (changed: boolean) => void
	/**
	 * 获取当前表单值与初始值的差异
	 */
	getChanges: () => Record<string, any>
	/**
	 * 获取初始值
	 */
	getInitialValues: () => any
	/**
	 * 手动触发变更检测
	 */
	checkChanges: () => void
}

interface UseFormChangeDetectionParams {
	form: FormInstance
	initialValues: any
	options?: UseFormChangeDetectionOptions
}

/**
 * 通用的表单变更检测Hook
 *
 * @param form - Ant Design Form实例
 * @param initialValues - 表单的初始值
 * @param options - 配置选项
 * @returns 变更检测结果对象
 *
 * @example
 * ```tsx
 * const { hasChanges, resetChangeDetection } = useFormChangeDetection(form, initialValues, {
 *   watchFields: ['name', 'email'],
 *   ignoreFields: ['created_at'],
 *   debounceDelay: 500
 * })
 *
 * // 在关闭弹窗时检查
 * const handleClose = () => {
 *   if (hasChanges) {
 *     Modal.confirm({
 *       title: '确认关闭',
 *       content: '您有未保存的更改，确定要关闭吗？',
 *       onOk: () => {
 *         resetChangeDetection()
 *         onClose()
 *       }
 *     })
 *   } else {
 *     onClose()
 *   }
 * }
 * ```
 */
export function useFormChangeDetection({
	form,
	initialValues,
	options,
}: UseFormChangeDetectionParams): UseFormChangeDetectionResult {
	const {
		enabled = true,
		compareFn = isEqual,
		watchFields = [],
		ignoreFields = [],
		debounceDelay = 500,
	} = options || {}

	const [hasChanges, setHasChanges] = useState(false)
	const initialValuesRef = useRef(initialValues)
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

	// 获取当前表单值
	const getCurrentFormValues = useCallback(() => {
		try {
			const allValues = form.getFieldsValue(true)

			// 如果指定了要监听的字段，只返回这些字段的值
			if (watchFields.length > 0) {
				const filteredValues: any = {}
				watchFields.forEach((field) => {
					const value = form.getFieldValue(field)
					if (value !== undefined) {
						filteredValues[field] = value
					}
				})
				return filteredValues
			}

			return allValues
		} catch (error) {
			console.warn("获取表单值失败:", error)
			return {}
		}
	}, [form, watchFields])

	// 过滤掉忽略的字段
	const filterIgnoredFields = useCallback(
		(values: any) => {
			if (ignoreFields.length === 0) return values

			const filtered: any = {}
			Object.keys(values).forEach((key) => {
				if (!ignoreFields.includes(key)) {
					filtered[key] = values[key]
				}
			})
			return filtered
		},
		[ignoreFields],
	)

	const hasValue = useCallback((value: any) => {
		if (value === undefined || value === null || value === "") return false
		if (Array.isArray(value) && value.length === 0) return false
		if (typeof value === "object" && Object.keys(value).length === 0) return false
		return true
	}, [])

	const getFilteredValues = useCallback(
		(values: any) => {
			const result: any = {}
			Object.keys(values).forEach((key) => {
				if (hasValue(values[key])) {
					result[key] = values[key]
				}
			})
			return result
		},
		[hasValue],
	)

	// 检测变更
	const detectChanges = useCallback(() => {
		if (!enabled || !initialValuesRef.current) return

		const currentValues = getCurrentFormValues()
		const filteredCurrentValues = getFilteredValues(filterIgnoredFields(currentValues))
		const filteredInitialValues = getFilteredValues(
			filterIgnoredFields(initialValuesRef.current),
		)

		// console.log(filteredCurrentValues, filteredInitialValues)
		const changed = !compareFn(filteredCurrentValues, filteredInitialValues)
		setHasChanges(changed)
	}, [enabled, getCurrentFormValues, getFilteredValues, filterIgnoredFields, compareFn])

	// 防抖处理变更检测
	const debouncedDetectChanges = useCallback(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		debounceTimerRef.current = setTimeout(() => {
			detectChanges()
		}, debounceDelay)
	}, [detectChanges, debounceDelay])

	// 使用Form.useWatch监听表单变化（推荐方式）
	const formValues = Form.useWatch([], form)

	// 监听表单值变化
	useEffect(() => {
		if (!enabled || !formValues) return

		debouncedDetectChanges()
	}, [formValues, enabled, debouncedDetectChanges])

	// 更新初始值引用
	useEffect(() => {
		if (initialValues) {
			initialValuesRef.current = initialValues
			setHasChanges(false)
		}
	}, [initialValues])

	// 重置变更检测
	const resetChangeDetection = useCallback(() => {
		setHasChanges(false)
		initialValuesRef.current = getCurrentFormValues()
	}, [getCurrentFormValues])

	// 获取变更详情
	const getChanges = useCallback(() => {
		if (!initialValuesRef.current) return {}

		const currentValues = getCurrentFormValues()
		const changes: Record<string, any> = {}

		Object.keys(currentValues).forEach((key) => {
			if (ignoreFields.includes(key)) return

			const currentValue = currentValues[key]
			const initialValue = initialValuesRef.current[key]

			if (!compareFn(currentValue, initialValue)) {
				changes[key] = {
					from: initialValue,
					to: currentValue,
				}
			}
		})

		return changes
	}, [getCurrentFormValues, ignoreFields, compareFn])

	// 获取初始值
	const getInitialValues = useCallback(() => {
		return initialValuesRef.current
	}, [])

	// 手动触发变更检测
	const checkChanges = useCallback(() => {
		detectChanges()
	}, [detectChanges])

	return {
		hasChanges,
		resetChangeDetection,
		setHasChanges,
		getChanges,
		getInitialValues,
		checkChanges,
	}
}

export default useFormChangeDetection
