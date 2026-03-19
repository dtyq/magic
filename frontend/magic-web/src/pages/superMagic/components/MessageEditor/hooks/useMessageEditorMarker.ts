import { useEffect, useMemo, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { Editor } from "@tiptap/react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	MentionItemType,
	CanvasMarkerMentionData,
} from "@/components/business/MentionPanel/types"
import type { Marker } from "@/components/CanvasDesign/canvas/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type {
	IdentifyImageMarkResponse,
	IdentifyImageMarkResponseBase,
} from "@/components/CanvasDesign/types.magic"
import { SuperMagicMarkerManager } from "@/pages/superMagic/components/Detail/contents/Design/marker-manager"
import type { JSONContent } from "@tiptap/core"
import { hasLoadingMarkerInContent } from "../utils/mention"

interface UseMessageEditorMarkerOptions {
	/** 获取 TipTap 编辑器实例（避免首帧 null，推荐传入 () => tiptapEditorRef.current） */
	getEditor: () => Editor | null
	/** 当前编辑器内容，用于计算 hasLoadingMarker（需与 store.editorStore.value 同步） */
	content?: JSONContent | undefined
}

interface UseMessageEditorMarkerReturn {
	/** 是否有 marker 处于 loading 状态（有则禁止发送、不保存草稿） */
	hasLoadingMarker: boolean
	/** 处理 marker 移除（供 useUploadMentionFlow 调用） */
	handleMarkerMentionRemove: (mentionAttrs: TiptapMentionAttributes) => void
	/** Undo/粘贴等场景：将插入的 DESIGN_MARKER 同步到 Manager，供 onMentionInsertItems 调用 */
	syncInsertedMarkersToManager: (items: Array<{ type?: string; data?: unknown }>) => void
}

/**
 * 从编辑器中删除指定的 marker 节点
 */
function removeMarkerNodesFromEditor(
	editor: Editor,
	markerId: string,
	designProjectId: string,
): void {
	const { state, dispatch } = editor.view
	const { tr } = state
	const toDelete: { from: number; to: number }[] = []

	state.doc.descendants((node, pos) => {
		if (node.type.name === "mention") {
			const attrs = node.attrs as TiptapMentionAttributes
			if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
				const markerData = attrs.data as CanvasMarkerMentionData
				if (
					markerData?.data?.id === markerId &&
					markerData?.design_project_id === designProjectId
				) {
					toDelete.push({ from: pos, to: pos + node.nodeSize })
				}
			}
		}
		return true
	})

	// 从后往前删除，避免位置偏移问题
	toDelete.reverse().forEach(({ from, to }) => {
		tr.delete(from, to)
	})

	if (tr.steps.length > 0) {
		dispatch(tr)
	}
}

/**
 * 更新编辑器中所有 marker 节点的 mark_number
 */
function updateMarkerNumbersInEditor(editor: Editor): void {
	const { state, dispatch } = editor.view
	const { tr } = state

	// 1. 收集所有 marker 节点
	const markers: Array<{
		attrs: TiptapMentionAttributes
		pos: number
		data: CanvasMarkerMentionData
	}> = []

	state.doc.descendants((node, pos) => {
		if (node.type.name === "mention") {
			const attrs = node.attrs as TiptapMentionAttributes
			if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
				const markerData = attrs.data as CanvasMarkerMentionData
				if (markerData?.data?.id) {
					markers.push({ attrs, pos, data: markerData })
				}
			}
		}
		return true
	})

	if (markers.length === 0) return

	// 2. 按 mark_number 排序（如果存在），否则保持原有顺序
	const sortedMarkers = [...markers].sort((a, b) => {
		const numberA = a.data?.mark_number ?? Infinity
		const numberB = b.data?.mark_number ?? Infinity
		return numberA - numberB
	})

	// 3. 重新编号并更新
	sortedMarkers.forEach(({ attrs, pos, data }, index) => {
		const newMarkNumber = index + 1
		if (data.mark_number !== newMarkNumber) {
			const updatedData: CanvasMarkerMentionData = {
				...data,
				mark_number: newMarkNumber,
			}
			tr.setNodeMarkup(pos, undefined, {
				...attrs,
				data: updatedData,
			})
		}
	})

	if (tr.steps.length > 0) {
		dispatch(tr)
	}
}

/**
 * 更新编辑器中指定 marker 的属性
 */
function updateMarkerAttributesInEditor(
	editor: Editor,
	markerId: string,
	designProjectId: string,
	updates: Partial<CanvasMarkerMentionData>,
): void {
	const { state, dispatch } = editor.view
	const { tr } = state

	// 过滤掉 undefined 值
	const filteredUpdates = Object.fromEntries(
		Object.entries(updates).filter(([, value]) => value !== undefined),
	) as Partial<CanvasMarkerMentionData>

	state.doc.descendants((node, pos) => {
		if (node.type.name === "mention") {
			const attrs = node.attrs as TiptapMentionAttributes
			if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
				const markerData = attrs.data as CanvasMarkerMentionData
				if (
					markerData?.data?.id === markerId &&
					markerData?.design_project_id === designProjectId
				) {
					const updatedData: CanvasMarkerMentionData = {
						...markerData,
						...filteredUpdates,
					}
					tr.setNodeMarkup(pos, undefined, {
						...node.attrs,
						data: updatedData,
					})
				}
			}
		}
		return true
	})

	if (tr.steps.length > 0) {
		dispatch(tr)
	}
}

/**
 * 批量更新编辑器中多个 marker 的属性
 */
function batchUpdateMarkerAttributesInEditor(
	editor: Editor,
	updates: Array<{
		markerId: string
		designProjectId: string
		data: Partial<CanvasMarkerMentionData>
	}>,
): void {
	if (updates.length === 0) return

	const { state, dispatch } = editor.view
	const { tr } = state

	// 创建更新映射
	const updatesMap = new Map<
		string,
		{ designProjectId: string; data: Partial<CanvasMarkerMentionData> }
	>()
	updates.forEach(({ markerId, designProjectId, data }) => {
		const filteredUpdates = Object.fromEntries(
			Object.entries(data).filter(([, value]) => value !== undefined),
		) as Partial<CanvasMarkerMentionData>
		updatesMap.set(markerId, { designProjectId, data: filteredUpdates })
	})

	state.doc.descendants((node, pos) => {
		if (node.type.name === "mention") {
			const attrs = node.attrs as TiptapMentionAttributes
			if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
				const markerData = attrs.data as CanvasMarkerMentionData
				const markerId = markerData?.data?.id
				const designProjectId = markerData?.design_project_id

				if (markerId && designProjectId) {
					const update = updatesMap.get(markerId)
					if (update && update.designProjectId === designProjectId) {
						const updatedData: CanvasMarkerMentionData = {
							...markerData,
							...update.data,
						}
						tr.setNodeMarkup(pos, undefined, {
							...node.attrs,
							data: updatedData,
						})
					}
				}
			}
		}
		return true
	})

	if (tr.steps.length > 0) {
		dispatch(tr)
	}
}

/**
 * 处理 MessageEditor 中 marker 相关逻辑的 hook
 * 通过 pubsub 事件与 Marker-manager 通讯，直接操作编辑器内容
 */
export function useMessageEditorMarker(
	options: UseMessageEditorMarkerOptions,
): UseMessageEditorMarkerReturn {
	const { getEditor, content } = options

	const hasLoadingMarker = useMemo(() => hasLoadingMarkerInContent(content), [content])

	// 防重入：避免 pubsub 与 appendTransaction 双路径导致递归/重复处理
	const isRemovingMarkerRef = useRef(false)

	// 获取 Manager 实例
	const markerManager = SuperMagicMarkerManager.getInstance()

	// Undo/粘贴等场景：将 DESIGN_MARKER 同步到 Manager，便于 Design 画布显示
	const syncInsertedMarkersToManager = useMemoizedFn(
		(items: Array<{ type?: string; data?: unknown }>) => {
			items.forEach((item) => {
				if (item.type === MentionItemType.DESIGN_MARKER && item.data) {
					const data = item.data as CanvasMarkerMentionData
					if (data.design_project_id && data.data?.id) {
						markerManager.syncFromCanvasMarkerMentionData(data)
					}
				}
			})
		},
	)

	// 处理 marker 移除（供 handleMentionRemoveItems 调用）
	const handleMarkerMentionRemove = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		const markerData = mentionAttrs.data as CanvasMarkerMentionData
		const designProjectId = markerData?.design_project_id ?? ""
		const markerId = markerData?.data?.id ?? ""

		if (!markerId || !designProjectId) return

		const currentEditor = getEditor()
		if (!currentEditor || currentEditor.isDestroyed) return

		if (isRemovingMarkerRef.current) return
		isRemovingMarkerRef.current = true

		try {
			// 1. 更新 SuperMagicMarkerManager（画布未打开时 Design 未挂载，必须在此更新）
			markerManager.removeMarker(designProjectId, markerId)

			// 2. 从编辑器删除节点
			removeMarkerNodesFromEditor(currentEditor, markerId, designProjectId)

			// 3. 更新剩余 marker 的序号
			updateMarkerNumbersInEditor(currentEditor)

			// 4. 通知 Design 同步画布（画布打开时）
			pubsub.publish(PubSubEvents.Super_Magic_Marker_Removed, {
				markerId,
				designProjectId,
				source: "chat",
			})
		} finally {
			isRemovingMarkerRef.current = false
		}
	})

	// 监听 marker 插入（在光标处插入单个 marker）
	// 仅 insertContent，由 MentionExtension.appendTransaction 统一检测并同步
	useEffect(() => {
		const handleInsertMarker = (data: { items: TiptapMentionAttributes[] }) => {
			const { items } = data
			if (!Array.isArray(items) || items.length === 0) return

			const currentEditor = getEditor()
			if (!currentEditor || currentEditor.isDestroyed) return

			const mentions = items.map((attrs) => ({
				type: "mention" as const,
				attrs: { type: attrs.type, data: attrs.data },
			}))
			currentEditor.commands.insertContent(mentions)
			// 不聚焦，画布有连续添加标记的场景
		}

		pubsub.subscribe(PubSubEvents.Super_Magic_Insert_Marker_To_Chat, handleInsertMarker)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Insert_Marker_To_Chat, handleInsertMarker)
		}
	}, [getEditor])

	// 监听 marker 批量同步（画布恢复场景）
	useEffect(() => {
		const handleSyncMarkers = (data: { items: TiptapMentionAttributes[] }) => {
			const { items } = data
			if (!Array.isArray(items) || items.length === 0) return

			const currentEditor = getEditor()
			if (!currentEditor || currentEditor.isDestroyed) return

			// 更新编辑器中已有的 marker 节点属性
			const updates: Array<{
				markerId: string
				designProjectId: string
				data: Partial<CanvasMarkerMentionData>
			}> = []

			// 收集需要更新的 marker
			currentEditor.state.doc.descendants((node) => {
				if (node.type.name === "mention") {
					const attrs = node.attrs as TiptapMentionAttributes
					if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
						const markerData = attrs.data as CanvasMarkerMentionData
						const markId = markerData?.data?.id
						if (markId) {
							const replacement = items.find(
								(i) => (i.data as CanvasMarkerMentionData)?.data?.id === markId,
							)
							if (replacement) {
								const replacementData = replacement.data as CanvasMarkerMentionData
								updates.push({
									markerId: markId,
									designProjectId: replacementData.design_project_id ?? "",
									data: replacementData,
								})
							}
						}
					}
				}
				return true
			})

			// 批量更新
			if (updates.length > 0) {
				batchUpdateMarkerAttributesInEditor(currentEditor, updates)
			}

			// 添加新的 marker（编辑器中不存在的）
			const existingIds = new Set<string>()
			currentEditor.state.doc.descendants((node) => {
				if (node.type.name === "mention") {
					const attrs = node.attrs as TiptapMentionAttributes
					if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
						const markerData = attrs.data as CanvasMarkerMentionData
						if (markerData?.data?.id) {
							existingIds.add(markerData.data.id)
						}
					}
				}
				return true
			})

			const toAdd = items.filter((i) => {
				const markId = (i.data as CanvasMarkerMentionData)?.data?.id
				return markId && !existingIds.has(markId)
			})

			if (toAdd.length > 0) {
				const mentions = toAdd.map((attrs) => ({
					type: "mention" as const,
					attrs: { type: attrs.type, data: attrs.data },
				}))
				currentEditor.commands.insertContent(mentions)
			}
		}

		pubsub.subscribe(PubSubEvents.Super_Magic_Sync_Markers_To_Chat, handleSyncMarkers)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Sync_Markers_To_Chat, handleSyncMarkers)
		}
	}, [getEditor])

	// 监听 marker 删除事件（source=canvas 时同步 Chat）
	useEffect(() => {
		const handleMarkerRemoved = (data: {
			markerId: string
			designProjectId?: string
			source: "canvas" | "chat"
		}) => {
			const { markerId, designProjectId, source } = data
			if (!markerId || source !== "canvas") return

			const currentEditor = getEditor()
			if (!currentEditor || currentEditor.isDestroyed) return

			if (isRemovingMarkerRef.current) return
			isRemovingMarkerRef.current = true

			try {
				// 从编辑器删除节点
				if (designProjectId) {
					removeMarkerNodesFromEditor(currentEditor, markerId, designProjectId)
					// 更新剩余 marker 的序号
					updateMarkerNumbersInEditor(currentEditor)
				}
			} finally {
				isRemovingMarkerRef.current = false
			}
		}

		pubsub.subscribe(PubSubEvents.Super_Magic_Marker_Removed, handleMarkerRemoved)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Marker_Removed, handleMarkerRemoved)
		}
	}, [getEditor])

	// 监听 marker 数据更新（统一事件：fetch 完成 / Chat 选择 suggestion）
	useEffect(() => {
		const handleMarkerDataUpdated = (data: {
			markerId: string
			designProjectId?: string
			result?: IdentifyImageMarkResponse
			error?: string
			suggestions?: IdentifyImageMarkResponseBase["suggestions"]
			selectedSuggestionIndex?: number
			loading?: boolean
			updates?: Array<{
				markerId: string
				data: Partial<CanvasMarkerMentionData>
			}>
		}) => {
			const currentEditor = getEditor()
			if (!currentEditor || currentEditor.isDestroyed) return

			// 批量更新模式
			if (data.updates && Array.isArray(data.updates)) {
				if (data.updates.length === 0) return

				const batchUpdates = data.updates
					.map((update) => {
						// 需要从编辑器中获取 designProjectId
						let designProjectId = ""
						currentEditor.state.doc.descendants((node) => {
							if (node.type.name === "mention") {
								const attrs = node.attrs as TiptapMentionAttributes
								if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
									const markerData = attrs.data as CanvasMarkerMentionData
									if (markerData?.data?.id === update.markerId) {
										designProjectId = markerData.design_project_id ?? ""
										return false // 找到后停止遍历
									}
								}
							}
							return true
						})

						return {
							markerId: update.markerId,
							designProjectId,
							data: update.data,
						}
					})
					.filter((update) => update.designProjectId) // 过滤掉找不到 designProjectId 的

				if (batchUpdates.length > 0) {
					batchUpdateMarkerAttributesInEditor(currentEditor, batchUpdates)
				}
				return
			}

			// 单个更新模式
			const {
				markerId,
				result,
				error,
				suggestions,
				selectedSuggestionIndex,
				loading,
				designProjectId,
			} = data
			if (!markerId) return

			// 从编辑器中获取当前的 marker 数据
			let currentMarkerData: CanvasMarkerMentionData | null = null
			let foundDesignProjectId = designProjectId ?? ""

			currentEditor.state.doc.descendants((node) => {
				if (node.type.name === "mention") {
					const attrs = node.attrs as TiptapMentionAttributes
					if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
						const markerData = attrs.data as CanvasMarkerMentionData
						if (markerData?.data?.id === markerId) {
							currentMarkerData = markerData
							foundDesignProjectId = markerData.design_project_id ?? ""
							return false // 找到后停止遍历
						}
					}
				}
				return true
			})

			if (!currentMarkerData || !foundDesignProjectId) return

			// 类型断言：确保 data 存在
			const markerData: Marker | undefined = (currentMarkerData as CanvasMarkerMentionData)
				.data
			if (!markerData) return

			const chatData: Partial<CanvasMarkerMentionData> = {}
			// fetch 成功或失败时都应清除 loading 状态
			if (error !== undefined || result !== undefined) chatData.loading = false
			if (loading !== undefined) chatData.loading = loading

			// 更新 data.result 和 data.selectedSuggestionIndex
			// result !== undefined：fetch 完成后传入完整 result，即使无 suggestions 也需更新
			const shouldUpdateData =
				result !== undefined ||
				suggestions !== undefined ||
				selectedSuggestionIndex !== undefined ||
				error !== undefined

			if (shouldUpdateData) {
				const currentMarker: Marker = markerData
				let updatedResult: IdentifyImageMarkResponse | undefined = currentMarker.result

				// fetch 完成：直接使用完整的 result（首次加载时 currentMarker.result 为 undefined，必须用 event 的 result）
				if (result !== undefined) {
					updatedResult = result as IdentifyImageMarkResponse
				}
				// Chat 选择 suggestion：只更新 suggestions，与现有 result 合并（此时 result 未传入，仅 suggestions）
				else if (suggestions !== undefined && currentMarker.result) {
					const newSuggestions = suggestions
					if (newSuggestions) {
						updatedResult = {
							...currentMarker.result,
							suggestions: newSuggestions,
						} as IdentifyImageMarkResponse
					}
				}

				const updatedMarker: Marker = {
					...currentMarker,
					result: updatedResult,
					selectedSuggestionIndex:
						selectedSuggestionIndex !== undefined
							? selectedSuggestionIndex
							: currentMarker.selectedSuggestionIndex,
					error: error !== undefined ? error : currentMarker.error,
				}
				chatData.data = updatedMarker
			}

			if (Object.keys(chatData).length > 0) {
				updateMarkerAttributesInEditor(
					currentEditor,
					markerId,
					foundDesignProjectId,
					chatData,
				)
			}
		}

		pubsub.subscribe(PubSubEvents.Super_Magic_Marker_Data_Updated, handleMarkerDataUpdated)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Marker_Data_Updated,
				handleMarkerDataUpdated,
			)
		}
	}, [getEditor])

	return {
		hasLoadingMarker,
		handleMarkerMentionRemove,
		syncInsertedMarkersToManager,
	}
}
