import { useCallback, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import {
	CanvasDocument,
	ElementTypeEnum,
	type LayerElement,
	type ImageElement,
} from "@/opensource/components/CanvasDesign/canvas/types"
import type {
	CanvasDesignMethods,
	IdentifyImageMarkResponse,
} from "@/opensource/components/CanvasDesign/types.magic"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { Marker } from "@/opensource/components/CanvasDesign/canvas/types"
import type {
	ProjectListItem,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import type { TFunction } from "i18next"
import { CanvasDesignRef } from "@/opensource/components/CanvasDesign/types"
import { isLikelyAbortError, type SuperMagicMarkerManager } from "../marker-manager"

interface UseDesignMarkerOptions {
	/** 画布数据（包含 elements 和 markers） */
	canvas?: CanvasDocument
	/** CanvasDesign 的方法集合 */
	methods: CanvasDesignMethods
	/** 项目 ID */
	projectId?: string
	/** 设计项目 ID（用于 Manager 读写） */
	designProjectId?: string
	/** SuperMagic Marker Manager（负责持久化与 fetch） */
	markerManager?: SuperMagicMarkerManager | null
	/** Topic ID */
	topicId?: string
	/** 显示名称 */
	displayName?: string
	/** CanvasDesign 的 ref */
	canvasDesignRef: React.RefObject<CanvasDesignRef | null>
	/** 选中的项目 */
	selectedProject?: ProjectListItem | null
	/** 选中的工作区 */
	selectedWorkspace?: Workspace | null
	/** 翻译函数 */
	t: TFunction
}

interface UseDesignMarkerReturn {
	/** 处理 marker 创建事件 */
	handleMarkerCreated: (marker: Marker) => void
	/** 处理 marker 删除事件 */
	handleMarkerDeleted: (markerId: string) => void
	/** 处理 marker 更新事件 */
	handleMarkerUpdated: (marker: Marker, markers: Marker[]) => void
	/** 处理 marker 恢复事件（从 storage 恢复） */
	handleMarkerRestored: (markers: Marker[]) => void
}

/**
 * 处理 Design 组件中 marker 相关逻辑的 hook
 * 包括 marker 的创建、删除、同步到 MessageEditor 等功能
 */
export function useDesignMarker(options: UseDesignMarkerOptions): UseDesignMarkerReturn {
	const { canvas, designProjectId, markerManager, displayName, canvasDesignRef } = options

	// 递归查找图片元素
	const findImageElement = useCallback(
		(elementId: string, elements?: LayerElement[]): LayerElement | null => {
			if (!elements) {
				return null
			}
			for (const element of elements) {
				if (element.id === elementId) {
					// 检查是否是图片元素
					if (element.type === ElementTypeEnum.Image) {
						return element
					}
					return null
				}
				// 递归查找子元素
				if ("children" in element && element.children && Array.isArray(element.children)) {
					const found = findImageElement(elementId, element.children)
					if (found) return found
				}
			}
			return null
		},
		[],
	)

	// 更新 marker 的 suggestion 到 MessageEditor
	const updateMarkerSuggestionData = useCallback(
		(
			markerId: string,
			_suggestion: string, // 保留参数以保持 API 兼容性，但不再使用
			suggestions?: IdentifyImageMarkResponse["suggestions"],
			selectedSuggestionIndex?: number,
			isError = false,
		) => {
			// 如果出错，创建一个包含错误信息的 suggestion 项
			const finalSuggestions = isError
				? [
						{
							label: displayName || `Marker ${markerId.slice(0, 8)}`,
							kind: "custom" as const,
						},
					]
				: suggestions
			pubsub.publish(PubSubEvents.Super_Magic_Marker_Data_Updated, {
				markerId,
				designProjectId,
				suggestions: finalSuggestions,
				selectedSuggestionIndex: isError ? 0 : selectedSuggestionIndex,
				loading: false,
			})
		},
		[designProjectId, displayName],
	)

	// 处理 marker 创建事件（入口：委托 Manager 做 addMarker、fetchMarkerData、syncToMessageEditor）
	const handleMarkerCreated = useCallback(
		async (marker: Marker) => {
			if (designProjectId && markerManager) {
				const el = findImageElement(
					marker.elementId,
					canvas?.elements,
				) as ImageElement | null
				const element = el?.src ? { src: el.src } : undefined
				markerManager.addMarker(designProjectId, marker, element)
				markerManager.fetchMarkerData(designProjectId, marker.id)
				await markerManager.syncToMessageEditor(designProjectId, "insert", {
					markerId: marker.id,
				})
			}
		},
		[designProjectId, markerManager, canvas?.elements, findImageElement],
	)

	// 处理 marker 更新事件（识别结果获取成功/失败）
	const handleMarkerUpdated = useCallback(
		(marker: Marker, markers: Marker[]) => {
			if (designProjectId && markerManager) {
				markerManager.setMarkers(designProjectId, markers)
			}
			if (!marker.result) {
				if (marker.error) {
					updateMarkerSuggestionData(marker.id, "", undefined, undefined, true)
				}
				return
			}
			updateMarkerSuggestionData(
				marker.id,
				marker.result.suggestion,
				marker.result.suggestions,
				marker.selectedSuggestionIndex,
			)
		},
		[designProjectId, markerManager, updateMarkerSuggestionData],
	)

	// 处理 marker 删除事件（从画布删除）
	const handleMarkerDeleted = useCallback(
		(markerId: string) => {
			if (designProjectId && markerManager) {
				markerManager.removeMarker(designProjectId, markerId)
			}
			pubsub.publish(PubSubEvents.Super_Magic_Marker_Removed, {
				markerId,
				designProjectId: designProjectId ?? "",
				source: "canvas",
			})
		},
		[designProjectId, markerManager],
	)

	// 同步 markers 到 MessageEditor（入口：委托 Manager 执行核心 sync 逻辑）
	const syncMarkersToEditor = useMemoizedFn(async () => {
		if (!designProjectId || !markerManager) return
		await markerManager.syncToMessageEditor(designProjectId, "restore")
	})

	// 处理 marker 恢复事件（入口：委托 Manager 做 sync + fetch）
	const handleMarkerRestored = useCallback(
		(markers: Marker[]) => {
			syncMarkersToEditor()
			if (designProjectId && markerManager) {
				const toFetch = markers.filter(
					(m) => !m.result && (!m.error || isLikelyAbortError(m.error)),
				)
				toFetch.forEach((m) => {
					markerManager.fetchMarkerData(designProjectId, m.id)
				})
			}
		},
		[syncMarkersToEditor, designProjectId, markerManager],
	)

	// 监听 marker 删除事件（source=chat 时同步画布）
	useEffect(() => {
		const handleMarkerRemoved = (data: {
			markerId: string
			designProjectId?: string
			source: "canvas" | "chat"
		}) => {
			const { markerId, designProjectId: payloadProjectId, source } = data
			if (!markerId || source !== "chat") return
			// 仅处理当前 designProject 的事件，避免跨话题/跨画布同步
			if (designProjectId && payloadProjectId && designProjectId !== payloadProjectId) return

			const projectId = payloadProjectId ?? designProjectId ?? ""
			if (projectId && markerManager) {
				markerManager.removeMarker(projectId, markerId)
			}
			if (canvasDesignRef.current) {
				canvasDesignRef.current.removeMarker(markerId)
			}
		}
		pubsub.subscribe(PubSubEvents.Super_Magic_Marker_Removed, handleMarkerRemoved)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Marker_Removed, handleMarkerRemoved)
		}
	}, [canvasDesignRef, designProjectId, markerManager])

	// 监听 marker 数据更新（fetch 完成 / Chat 选择 suggestion）
	useEffect(() => {
		const handleMarkerDataUpdated = (data: {
			markerId: string
			designProjectId?: string
			result?: IdentifyImageMarkResponse
			error?: string
			suggestions?: IdentifyImageMarkResponse["suggestions"]
			selectedSuggestionIndex?: number
		}) => {
			const { markerId, result, suggestions, selectedSuggestionIndex } = data
			if (!markerId || !canvasDesignRef.current) return

			try {
				const currentMarker = canvasDesignRef.current.getMarker(markerId)
				if (!currentMarker) return

				const updates: Partial<Marker> = {}
				let hasChanges = false

				if (result !== undefined) {
					updates.result = result
					updates.error = undefined
					hasChanges = true
				}
				if (data.error !== undefined) {
					updates.error = data.error
					hasChanges = true
				}
				if (
					selectedSuggestionIndex !== undefined &&
					currentMarker.selectedSuggestionIndex !== selectedSuggestionIndex
				) {
					updates.selectedSuggestionIndex = selectedSuggestionIndex
					hasChanges = true
				}
				if (suggestions !== undefined && currentMarker.result) {
					const suggestionsChanged =
						JSON.stringify(currentMarker.result.suggestions) !==
						JSON.stringify(suggestions)
					if (suggestionsChanged) {
						updates.result = {
							...currentMarker.result,
							suggestions,
						}
						hasChanges = true
					}
				}
				if (hasChanges && Object.keys(updates).length > 0) {
					canvasDesignRef.current.updateMarker(markerId, updates)
				}
			} catch {
				//
			}
		}
		pubsub.subscribe(PubSubEvents.Super_Magic_Marker_Data_Updated, handleMarkerDataUpdated)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Marker_Data_Updated,
				handleMarkerDataUpdated,
			)
		}
	}, [canvasDesignRef])

	// 监听清除所有 marker 的事件（切换话题时）
	useEffect(() => {
		const handleClearAllMarkersFromCanvas = () => {
			if (designProjectId && markerManager) {
				markerManager.clearMarkers(designProjectId)
			}
			if (!canvasDesignRef.current) return
			try {
				canvasDesignRef.current.clearMarkers()
			} catch (error) {
				//
			}
		}
		pubsub.subscribe(
			PubSubEvents.Super_Magic_Clear_Canvas_Markers,
			handleClearAllMarkersFromCanvas,
		)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Clear_Canvas_Markers,
				handleClearAllMarkersFromCanvas,
			)
		}
	}, [canvasDesignRef, designProjectId, markerManager])

	// 监听 Manager 新增 marker（草稿箱恢复、Redo 等），同步到画布
	useEffect(() => {
		const handleMarkersSyncedToManager = (data: { designProjectId?: string }) => {
			const payloadProjectId = data?.designProjectId
			if (!payloadProjectId || !designProjectId || payloadProjectId !== designProjectId)
				return
			if (!markerManager || !canvasDesignRef.current) return
			const managerMarkers = markerManager.getMarkers(designProjectId)
			const canvasMarkers = canvasDesignRef.current.getMarkers()
			const canvasIds = new Set(canvasMarkers.map((m) => m.id))
			const toAdd = managerMarkers.filter((m) => !canvasIds.has(m.id))
			if (toAdd.length > 0) {
				// 草稿恢复/批量同步场景：silent 避免触发 marker:created → syncToMessageEditor，编辑器内容已由 restoreContent 恢复
				canvasDesignRef.current.addMarkers(toAdd, { silent: true })
			}
		}
		pubsub.subscribe(
			PubSubEvents.Super_Magic_Markers_Synced_To_Manager,
			handleMarkersSyncedToManager,
		)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Markers_Synced_To_Manager,
				handleMarkersSyncedToManager,
			)
		}
	}, [canvasDesignRef, designProjectId, markerManager])

	return {
		handleMarkerCreated,
		handleMarkerDeleted,
		handleMarkerUpdated,
		handleMarkerRestored,
	}
}
