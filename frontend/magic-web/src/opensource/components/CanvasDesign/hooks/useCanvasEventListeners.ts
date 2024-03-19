import { useLatest, useDebounceFn } from "ahooks"
import { useCanvas } from "../context/CanvasContext"
import { useCanvasEvents } from "./useCanvasEvent"
import type { CanvasDesignStorageData, CanvasDesignMethods } from "../types.magic"
import type { Marker, CanvasDocument } from "../canvas/types"

interface UseCanvasEventListenersOptions {
	/** 是否为只读模式 */
	readonly?: boolean
	/** Magic 方法 */
	methods?: CanvasDesignMethods
	/** marker 选中状态变化回调 */
	onMarkerSelectChange?: (markerId: string | null) => void
	/** 创建 marker 前的回调 */
	beforeMarkerCreate?: (marker: Marker) => void
	/** marker 创建回调 */
	onMarkerCreated?: (marker: Marker) => void
	/** marker 删除回调 */
	onMarkerDeleted?: (id: string) => void
	/** marker 数据更新回调（仅在更新时触发） */
	onMarkerUpdated?: (marker: Marker, markers: Marker[]) => void
	/** 画布数据变化回调 */
	onCanvasDesignDataChange?: (canvasData: CanvasDocument) => void
}

/**
 * 处理所有 Canvas 事件监听
 * 职责：统一管理所有 Canvas 事件的订阅和处理
 */
export function useCanvasEventListeners(options: UseCanvasEventListenersOptions): void {
	const {
		readonly,
		methods,
		onMarkerSelectChange,
		beforeMarkerCreate,
		onMarkerCreated,
		onMarkerDeleted,
		onMarkerUpdated,
		onCanvasDesignDataChange,
	} = options

	const { canvas } = useCanvas()

	// 使用 useLatest 保存回调函数引用，避免重复订阅
	const onMarkerSelectChangeRef = useLatest(onMarkerSelectChange)
	const beforeMarkerCreateRef = useLatest(beforeMarkerCreate)
	const onMarkerCreatedRef = useLatest(onMarkerCreated)
	const onMarkerDeletedRef = useLatest(onMarkerDeleted)
	const onMarkerUpdatedRef = useLatest(onMarkerUpdated)
	const onCanvasDesignDataChangeRef = useLatest(onCanvasDesignDataChange)
	const readonlyRef = useLatest(readonly)

	// 防抖保存 viewport 到 storage
	const { run: saveViewportToStorage } = useDebounceFn(
		() => {
			if (!canvas || !methods?.saveStorage) return
			try {
				const viewport = canvas.exportViewport()
				const existingData = methods.getStorage() || {}
				const storageData: CanvasDesignStorageData = {
					...existingData,
					viewport,
				}
				methods.saveStorage(storageData)
			} catch (error) {
				//
			}
		},
		{ wait: 300 },
	)

	// 监听 marker 选中状态变化
	useCanvasEvents(
		["marker:select"] as const,
		(event) => {
			if (onMarkerSelectChangeRef.current) {
				onMarkerSelectChangeRef.current(event.data.id)
			}
		},
		[canvas],
	)

	// 监听 marker 创建前事件
	useCanvasEvents(
		["marker:before-create"] as const,
		(event) => {
			if (beforeMarkerCreateRef.current) {
				// 传递 marker 副本作为通知，不修改原始对象
				beforeMarkerCreateRef.current(event.data.marker)
			}
		},
		[canvas],
	)

	// 监听 marker 创建事件
	useCanvasEvents(
		["marker:created"] as const,
		(event) => {
			if (onMarkerCreatedRef.current) {
				onMarkerCreatedRef.current(event.data.marker)
			}
		},
		[canvas],
	)

	// 监听 marker 删除事件
	useCanvasEvents(
		["marker:deleted"] as const,
		(event) => {
			if (onMarkerDeletedRef.current) {
				onMarkerDeletedRef.current(event.data.id)
			}
		},
		[canvas],
	)

	// 监听 marker 数据更新事件（仅在更新时触发）
	useCanvasEvents(
		["marker:updated"] as const,
		(event) => {
			if (!onMarkerUpdatedRef.current || !canvas) return
			// 获取最新的 markers 数组
			const markers = canvas.markerManager.exportMarkers()
			// 调用回调，传递更新的 marker 和最新的 markers 数组
			onMarkerUpdatedRef.current(event.data.marker, markers)
		},
		[canvas],
	)

	// 监听所有可能导致画布数据变化的事件
	useCanvasEvents(
		["element:change", "canvas:clear", "element:temporary:converted"] as const,
		() => {
			if (!canvas || !onCanvasDesignDataChangeRef.current || readonlyRef.current) return
			// 导出时不包含临时元素，避免保存上传中的图片到外部
			const canvasData = canvas.exportDocument({ includeTemporary: false })
			onCanvasDesignDataChangeRef.current(canvasData)
		},
		[canvas],
	)

	// 监听 viewport 变化，保存到 storage
	useCanvasEvents(
		["viewport:scale", "viewport:pan"] as const,
		() => {
			saveViewportToStorage()
		},
		[canvas, methods, saveViewportToStorage],
	)
}
