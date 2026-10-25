import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { DialogWindowOptions, DialogWindowSize } from "@/hooks/use-dialog-window"
import { useUserInfo } from "@/models/user/hooks"
import { platformKey } from "@/utils/storage"

const DEFAULT_RECOMMENDED_SIZE: DialogWindowSize = { width: 1120, height: 840 }
const DEFAULT_VIEWPORT_RATIO: DialogWindowSize = { width: 0.9, height: 0.86 }
const DEFAULT_MIN_SIZE: DialogWindowSize = { width: 720, height: 480 }

export interface DialogWindowFrameConfig {
	storageKeyPrefix: string
	recommendedSize?: DialogWindowSize
	minSize?: DialogWindowSize
	viewportRatio?: DialogWindowSize
}

interface ResizeGuideState {
	storageKey?: string
	visible: boolean
}

export interface DialogWindowFrame {
	windowOptions: DialogWindowOptions
	resizeGuideVisible: boolean
	dismissResizeGuide: () => void
	restoreRecommendedSize: () => void
}

export function useDialogWindowFrame(
	open: boolean,
	config: DialogWindowFrameConfig,
): DialogWindowFrame {
	const { userInfo } = useUserInfo()
	const identity =
		userInfo?.organization_code && userInfo.user_id
			? `${userInfo.organization_code}/${userInfo.user_id}`
			: undefined

	const sizeStorageKey = identity
		? platformKey(`${config.storageKeyPrefix}_size/${identity}`)
		: undefined
	const guideStorageKey = identity
		? platformKey(`${config.storageKeyPrefix}_resize_guide/${identity}`)
		: undefined

	const [resetSizeKey, setResetSizeKey] = useState(0)
	const [guide, setGuide] = useState<ResizeGuideState>({ visible: false })
	const completedGuideKeys = useRef(new Set<string>())

	useEffect(() => {
		if (!open || !guideStorageKey) return
		let completed = completedGuideKeys.current.has(guideStorageKey)
		try {
			completed ||= localStorage.getItem(guideStorageKey) === "1"
		} catch {
			// 存储失败时沿用本次挂载的完成记录，不影响窗口打开。
		}
		setGuide({ storageKey: guideStorageKey, visible: !completed })
	}, [guideStorageKey, open])

	const dismissResizeGuide = useMemoizedFn(() => {
		if (!guideStorageKey) return
		completedGuideKeys.current.add(guideStorageKey)
		setGuide({ storageKey: guideStorageKey, visible: false })
		try {
			localStorage.setItem(guideStorageKey, "1")
		} catch {
			// 写入失败也不在当前挂载期间重复提示。
		}
	})

	const restoreRecommendedSize = useMemoizedFn(() => {
		setResetSizeKey((previous) => previous + 1)
		dismissResizeGuide()
	})

	const viewport = window.visualViewport
	const recommended = config.recommendedSize ?? DEFAULT_RECOMMENDED_SIZE
	const ratio = config.viewportRatio ?? DEFAULT_VIEWPORT_RATIO
	const min = config.minSize ?? DEFAULT_MIN_SIZE

	const windowOptions: DialogWindowOptions = {
		open,
		draggable: true,
		resizable: true,
		defaultSize: {
			width: Math.min(
				recommended.width,
				(viewport?.width ?? window.innerWidth) * ratio.width,
			),
			height: Math.min(
				recommended.height,
				(viewport?.height ?? window.innerHeight) * ratio.height,
			),
		},
		minSize: min,
		sizeStorageKey,
		resetSizeKey,
		onResizeEnd: dismissResizeGuide,
	}

	return {
		windowOptions,
		resizeGuideVisible:
			open &&
			Boolean(guideStorageKey) &&
			guide.storageKey === guideStorageKey &&
			guide.visible,
		dismissResizeGuide,
		restoreRecommendedSize,
	}
}
