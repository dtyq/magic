import { useMemo, useCallback } from "react"
import type { CanvasDesignStorageData } from "@/components/CanvasDesign/types.magic"
import { CanvasDesignRootStorageData } from "@/components/CanvasDesign/types.magic"

interface UseCanvasStorageOptions {
	designProjectId?: string
}

interface UseCanvasStorageReturn {
	getStorage: () => CanvasDesignStorageData | null
	saveStorage: (data: CanvasDesignStorageData) => void
	getRootStorage: () => CanvasDesignRootStorageData | null
	saveRootStorage: (data: CanvasDesignRootStorageData) => void
}

/**
 * Canvas 本地存储功能 Hook
 * 职责：管理 Canvas 的本地存储数据
 * - 基于目录 ID (markId) 生成存储键
 * - 从 localStorage 读取存储数据
 * - 将存储数据保存到 localStorage
 */
export function useCanvasStorage(options: UseCanvasStorageOptions): UseCanvasStorageReturn {
	const { designProjectId } = options

	// 获取 storage key（基于目录ID），用于 viewport、expandedElementIds 和 layersCollapsed 的保存
	const storageKey = useMemo(() => {
		return designProjectId ? `MAGIC:supermagic-design:${designProjectId}` : null
	}, [designProjectId])

	const rootStorageKey = `MAGIC:supermagic-design`

	/**
	 * 获取存储数据
	 */
	const getStorage = useCallback((): CanvasDesignStorageData | null => {
		if (!storageKey) {
			return null
		}
		try {
			const stored = localStorage.getItem(storageKey)
			if (stored) {
				return JSON.parse(stored) as CanvasDesignStorageData
			}
			return null
		} catch (error) {
			return null
		}
	}, [storageKey])

	/**
	 * 保存存储数据
	 */
	const saveStorage = useCallback(
		(data: CanvasDesignStorageData): void => {
			if (!storageKey) {
				return
			}
			try {
				localStorage.setItem(storageKey, JSON.stringify(data))
			} catch (error) {
				//
			}
		},
		[storageKey],
	)

	/**
	 * 获取根存储数据
	 */
	const getRootStorage = useCallback((): CanvasDesignRootStorageData | null => {
		try {
			const stored = localStorage.getItem(rootStorageKey)
			if (stored) {
				return JSON.parse(stored) as CanvasDesignRootStorageData
			}
			return null
		} catch (error) {
			return null
		}
	}, [rootStorageKey])

	/**
	 * 保存根存储数据
	 */
	const saveRootStorage = useCallback(
		(data: CanvasDesignRootStorageData): void => {
			try {
				localStorage.setItem(rootStorageKey, JSON.stringify(data))
			} catch (error) {
				//
			}
		},
		[rootStorageKey],
	)

	return {
		getStorage,
		saveStorage,
		getRootStorage,
		saveRootStorage,
	}
}
