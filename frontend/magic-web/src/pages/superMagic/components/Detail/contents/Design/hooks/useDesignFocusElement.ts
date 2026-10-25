import { useRef, useCallback, useEffect } from "react"
import { useLatest } from "ahooks"
import { CanvasDesignRef } from "@/components/CanvasDesign/public/props"
import {
	findCanvasMediaElementIdsByFileId,
	type CanvasResolvedMediaFile,
} from "@/components/CanvasDesign/public/canvas-media-elements"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SuperMagicFocusCanvasElementPayload } from "@/pages/superMagic/events/markers"

interface UseDesignFocusElementProps {
	isPlaybackMode?: boolean
	designProjectId?: string
	isInitialLoading: boolean
	canvasDesignRef: React.RefObject<CanvasDesignRef | null>
	resolveFileBySrc?: (src: string) => CanvasResolvedMediaFile | null
}

interface PendingFocusRequest {
	data: SuperMagicFocusCanvasElementPayload
	expiresAt: number
}

const FOCUS_REQUEST_TTL_MS = 60_000
const pendingFocusRequests = new Map<string, PendingFocusRequest>()

function getFocusRequestKey(data: SuperMagicFocusCanvasElementPayload) {
	return [
		data.canvasDesignId,
		!!data.isFromPlaybackToolNode,
		data.mediaFileId || "",
		data.contentId || "",
		...(data.elementIds ?? []),
	].join("\u0000")
}

function purgeExpiredFocusRequests(now = Date.now()) {
	for (const [key, request] of pendingFocusRequests) {
		if (request.expiresAt <= now) pendingFocusRequests.delete(key)
	}
}

/** Queue a focus request before the target Canvas mounts, then publish it through the existing event. */
export function requestCanvasElementFocus(data: SuperMagicFocusCanvasElementPayload) {
	purgeExpiredFocusRequests()
	pendingFocusRequests.set(getFocusRequestKey(data), {
		data,
		expiresAt: Date.now() + FOCUS_REQUEST_TTL_MS,
	})
	pubsub.publish(PubSubEvents.Super_Magic_Focus_Canvas_Element, data)
}

export function useDesignFocusElement({
	isPlaybackMode: isPlaybackModeProp,
	designProjectId,
	isInitialLoading,
	canvasDesignRef,
	resolveFileBySrc,
}: UseDesignFocusElementProps) {
	const isInitialLoadingRef = useLatest(isInitialLoading)

	// 待办事件队列：存储初始化完成前收到的回调函数
	const pendingCallbacksRef = useRef(new Map<string, () => void>())

	// 处理聚焦元素的函数
	const handleFocusElement = useCallback(
		(data: SuperMagicFocusCanvasElementPayload) => {
			const {
				isFromPlaybackToolNode,
				animated,
				canvasDesignId,
				selectElement,
				padding,
				showGenerationDetails,
				contentId,
			} = data
			const directElementIds = data.elementIds ?? []
			const mediaFileId = data.mediaFileId
			if (
				canvasDesignId !== designProjectId ||
				!!isPlaybackModeProp !== !!isFromPlaybackToolNode
			) {
				return
			}
			const requestKey = getFocusRequestKey(data)

			// 创建执行聚焦的回调函数
			const focusCallback = () => {
				const pendingRequest = pendingFocusRequests.get(requestKey)
				if (pendingRequest && pendingRequest.expiresAt <= Date.now()) {
					pendingFocusRequests.delete(requestKey)
					return
				}
				const targetElementIds =
					directElementIds.length > 0
						? directElementIds
						: mediaFileId && resolveFileBySrc
							? findCanvasMediaElementIdsByFileId(
									canvasDesignRef.current?.exportCurrentDocument()?.elements ||
										[],
									mediaFileId,
									resolveFileBySrc,
								)
							: []
				try {
					if (targetElementIds.length === 0) return

					canvasDesignRef.current?.focusElement(targetElementIds, {
						animated,
						selectElement,
						padding,
					})
					if (showGenerationDetails && targetElementIds.length === 1) {
						const canvas = canvasDesignRef.current?.getCanvasInstance()
						// 复用画布信息按钮事件，查看参数不会切换或写入主版本。
						canvas?.eventEmitter.emit({
							type: "element:image:infoButtonClick",
							data: { elementId: targetElementIds[0], contentId },
						})
					}
				} finally {
					pendingFocusRequests.delete(requestKey)
				}
			}

			// 检查是否初始化完成：loading 完成且 ref 已准备好
			const isInitialized = !isInitialLoadingRef.current && canvasDesignRef.current !== null

			if (isInitialized) {
				// 初始化完成，直接执行
				focusCallback()
			} else {
				// 初始化未完成，将回调加入待办队列
				pendingCallbacksRef.current.set(requestKey, focusCallback)
			}
		},
		[
			designProjectId,
			isPlaybackModeProp,
			isInitialLoadingRef,
			canvasDesignRef,
			resolveFileBySrc,
		],
	)

	// 消费待办事件队列
	const consumePendingEvents = useCallback(() => {
		if (!canvasDesignRef.current || pendingCallbacksRef.current.size === 0) return

		// 执行队列中的所有回调
		const callbacks = [...pendingCallbacksRef.current.values()]
		pendingCallbacksRef.current.clear()

		callbacks.forEach((callback) => {
			callback()
		})
	}, [canvasDesignRef])

	// 订阅事件
	useEffect(() => {
		const pendingCallbacks = pendingCallbacksRef.current
		pubsub.subscribe(PubSubEvents.Super_Magic_Focus_Canvas_Element, handleFocusElement)
		purgeExpiredFocusRequests()
		// Events published while opening a Canvas can arrive before this hook mounts.
		for (const { data: request } of pendingFocusRequests.values()) {
			handleFocusElement(request)
		}
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Focus_Canvas_Element, handleFocusElement)
			pendingCallbacks.clear()
		}
	}, [handleFocusElement])

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
