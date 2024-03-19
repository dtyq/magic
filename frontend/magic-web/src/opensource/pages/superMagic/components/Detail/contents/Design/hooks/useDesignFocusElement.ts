import { useRef, useCallback, useEffect } from "react"
import { useLatest } from "ahooks"
import { CanvasDesignRef } from "@/opensource/components/CanvasDesign/types"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { PaddingConfig } from "@/opensource/components/CanvasDesign/canvas/types"

interface UseDesignFocusElementProps {
	isPlaybackMode?: boolean
	designProjectId?: string
	isInitialLoading: boolean
	canvasDesignRef: React.RefObject<CanvasDesignRef | null>
}

export function useDesignFocusElement({
	isPlaybackMode: isPlaybackModeProp,
	designProjectId,
	isInitialLoading,
	canvasDesignRef,
}: UseDesignFocusElementProps) {
	const isInitialLoadingRef = useLatest(isInitialLoading)

	// 待办事件队列：存储初始化完成前收到的回调函数
	const pendingCallbacksRef = useRef<Array<() => void>>([])

	// 处理聚焦元素的函数
	const handleFocusElement = useCallback(
		(data: {
			isFromPlaybackToolNode?: boolean
			canvasDesignId: string
			elementIds: string[]
			selectElement?: string[] | boolean
			animated?: boolean
			padding?: PaddingConfig
		}) => {
			const {
				isFromPlaybackToolNode,
				animated,
				canvasDesignId,
				elementIds,
				selectElement,
				padding,
			} = data
			if (
				canvasDesignId !== designProjectId ||
				!!isPlaybackModeProp !== !!isFromPlaybackToolNode
			) {
				return
			}

			// 创建执行聚焦的回调函数
			const focusCallback = () => {
				canvasDesignRef.current?.focusElement(elementIds, {
					animated,
					selectElement,
					padding,
				})
			}

			// 检查是否初始化完成：loading 完成且 ref 已准备好
			const isInitialized = !isInitialLoadingRef.current && canvasDesignRef.current !== null

			if (isInitialized) {
				// 初始化完成，直接执行
				focusCallback()
			} else {
				// 初始化未完成，将回调加入待办队列
				pendingCallbacksRef.current.push(focusCallback)
			}
		},
		[designProjectId, isPlaybackModeProp, isInitialLoadingRef, canvasDesignRef],
	)

	// 消费待办事件队列
	const consumePendingEvents = useCallback(() => {
		if (!canvasDesignRef.current || pendingCallbacksRef.current.length === 0) return

		// 执行队列中的所有回调
		const callbacks = [...pendingCallbacksRef.current]
		pendingCallbacksRef.current = []

		callbacks.forEach((callback) => {
			callback()
		})
	}, [canvasDesignRef])

	// 处理选中标记并聚焦元素的事件
	const handleSelectMarkerAndFocus = useCallback(
		(data: {
			designProjectId: string
			markerId: string
			elementId: string
			shouldFocusElement: boolean
			shouldSelectMarker?: boolean
		}) => {
			const {
				designProjectId: targetDesignProjectId,
				markerId,
				elementId,
				shouldFocusElement,
				shouldSelectMarker = true, // 默认选中标记
			} = data

			// 检查是否是当前设计项目
			if (targetDesignProjectId !== designProjectId) {
				return
			}

			// 创建执行选中标记和聚焦的回调函数
			const selectAndFocusCallback = () => {
				if (!canvasDesignRef.current) return

				// 如果需要选中标记
				if (shouldSelectMarker) {
					canvasDesignRef.current.selectMarker(markerId)
				}

				// 如果需要聚焦元素
				if (shouldFocusElement) {
					canvasDesignRef.current.focusElement([elementId], {
						animated: true,
						selectElement: true,
						padding: { top: "25%", right: "25%", bottom: "25%", left: "25%" },
					})
				}
			}

			// 检查是否初始化完成：loading 完成且 ref 已准备好
			const isInitialized = !isInitialLoadingRef.current && canvasDesignRef.current !== null

			if (isInitialized) {
				// 初始化完成，直接执行
				selectAndFocusCallback()
			} else {
				// 初始化未完成，将回调加入待办队列
				pendingCallbacksRef.current.push(selectAndFocusCallback)
			}
		},
		[designProjectId, isInitialLoadingRef, canvasDesignRef],
	)

	// 订阅事件
	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Focus_Canvas_Element, handleFocusElement)
		pubsub.subscribe(
			PubSubEvents.Super_Magic_Select_Marker_And_Focus,
			handleSelectMarkerAndFocus,
		)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Focus_Canvas_Element, handleFocusElement)
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Select_Marker_And_Focus,
				handleSelectMarkerAndFocus,
			)
		}
	}, [handleFocusElement, handleSelectMarkerAndFocus])

	// 监听初始化完成，消费待办事件
	useEffect(() => {
		if (!isInitialLoading && canvasDesignRef.current) {
			// 延迟执行，确保 CanvasDesign 完全初始化
			const timer = setTimeout(() => {
				consumePendingEvents()
			}, 100)
			return () => clearTimeout(timer)
		}
	}, [isInitialLoading, consumePendingEvents, canvasDesignRef])

	return {
		handleFocusElement,
	}
}
