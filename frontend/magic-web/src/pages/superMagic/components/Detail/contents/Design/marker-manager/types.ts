import type { Marker } from "@/components/CanvasDesign/canvas/types"

export interface MarkerStorageOptions {
	storageKeyPrefix?: string
}

export interface SuperMagicMarkerManagerOptions {
	/** 获取存储键的函数 */
	getStorageKey?: (designProjectId: string) => string
	/** 存储适配器（可用于测试或自定义存储） */
	storage?: {
		getItem: (key: string) => string | null
		setItem: (key: string, value: string) => void
	}
}

export type SyncToMessageEditorMode = "restore" | "insert"

export interface SyncToMessageEditorOptions {
	/** insert 模式下指定要同步的 markerId */
	markerId?: string
}
