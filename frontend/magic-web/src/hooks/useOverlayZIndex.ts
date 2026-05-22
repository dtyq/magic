import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"

import {
	acquireOverlayZIndex,
	getOverlayScopeBaseZIndex,
	type OverlayZIndexEntry,
	type OverlayZIndexScope,
} from "@/utils/overlayZIndex/overlayStackManager"

export interface UseOverlayZIndexOptions {
	open: boolean
	zIndex?: number
	zIndexScope?: OverlayZIndexScope
	zIndexManaged?: boolean
}

export interface UseOverlayZIndexResult {
	overlayZIndex: number
	contentZIndex: number
	releaseOverlayZIndex: () => void
}

interface OverlayZIndexState {
	overlayZIndex: number
	contentZIndex: number
}

/** 将浮层 open 生命周期接入全局层级栈，并把释放时机交给组件在退场完成后显式触发。 */
export function useOverlayZIndex({
	open,
	zIndex,
	zIndexScope = "global",
	zIndexManaged = true,
}: UseOverlayZIndexOptions): UseOverlayZIndexResult {
	const releaseRef = useRef<OverlayZIndexEntry["release"] | null>(null)
	const [zIndexState, setZIndexState] = useState<OverlayZIndexState>(() =>
		createFallbackZIndexState(zIndex, zIndexScope),
	)

	useEffect(() => {
		if (!open) {
			return undefined
		}
		if (releaseRef.current) return undefined

		const entry = acquireOverlayZIndex({
			scope: zIndexScope,
			zIndex,
			zIndexManaged,
		})

		releaseRef.current = entry.release
		setZIndexState({
			overlayZIndex: entry.overlayZIndex,
			contentZIndex: entry.contentZIndex,
		})
	}, [open, zIndex, zIndexManaged, zIndexScope])

	/** 关闭动画结束后由接入组件显式释放，避免 DOM 仍在退场时过早回收层级。 */
	const handleReleaseOverlayZIndex = useCallback(() => {
		releaseOverlayZIndex(releaseRef)
		setZIndexState((prev) => {
			const next = createFallbackZIndexState(zIndex, zIndexScope)
			if (
				prev.overlayZIndex === next.overlayZIndex &&
				prev.contentZIndex === next.contentZIndex
			) {
				return prev
			}
			return next
		})
	}, [zIndex, zIndexScope])

	useEffect(() => {
		/** 组件被直接卸载时兜底释放，防止未走到动画完成回调时泄漏 activeCount。 */
		return () => {
			releaseOverlayZIndex(releaseRef)
		}
	}, [])

	return {
		...zIndexState,
		releaseOverlayZIndex: handleReleaseOverlayZIndex,
	}
}

/** 关闭和卸载都走同一释放入口，避免 StrictMode 或重复关闭导致计数错误。 */
function releaseOverlayZIndex(releaseRef: MutableRefObject<OverlayZIndexEntry["release"] | null>) {
	releaseRef.current?.()
	releaseRef.current = null
}

/** 在 effect 注册完成前提供稳定兜底层级，避免组件拿到 undefined style。 */
function createFallbackZIndexState(
	zIndex: number | undefined,
	scope: OverlayZIndexScope,
): OverlayZIndexState {
	const overlayZIndex = zIndex ?? getOverlayScopeBaseZIndex(scope)

	return {
		overlayZIndex,
		contentZIndex: overlayZIndex + 1,
	}
}
