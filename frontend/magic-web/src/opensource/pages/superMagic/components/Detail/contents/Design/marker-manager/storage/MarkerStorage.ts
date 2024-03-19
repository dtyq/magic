import type { Marker } from "@/opensource/components/CanvasDesign/canvas/types"
import { MarkerTypeEnum } from "@/opensource/components/CanvasDesign/canvas/types"
import type { CanvasDesignStorageData } from "@/opensource/components/CanvasDesign/types.magic"

const DEFAULT_STORAGE_KEY_PREFIX = "MAGIC:supermagic-design:"

/** 合成图上传路径缓存项（含校验 key，用于刷新后复用） */
export interface CompositePathCacheEntry {
	filePath: string
	/** 校验 key：elementSrc + marker 几何信息，用于判断缓存是否仍有效 */
	invalidationKey: string
	/** 图片尺寸信息，identify 时 Area 类型需要 naturalWidth/naturalHeight */
	imageInfo: { naturalWidth: number; naturalHeight: number }
}

/** 扩展存储结构，包含 marker 关联的 ImageElement.src 缓存（用于离开画布时 fetch） */
interface MarkerStorageData extends CanvasDesignStorageData {
	/** markerId -> 图片 src，画布添加 marker 时缓存，支持离画布 fetch */
	markerElementSrc?: Record<string, string>
	/** markerId -> 合成图上传路径缓存，避免刷新后重复上传 */
	markerCompositePath?: Record<string, CompositePathCacheEntry>
}

/** 根据 elementSrc + marker 几何信息生成校验 key */
export function buildMarkerCompositeKey(elementSrc: string, marker: Marker): string {
	const base = `${elementSrc}|${marker.relativeX},${marker.relativeY}`
	if (marker.type === MarkerTypeEnum.Area) {
		const area = marker as { areaWidth: number; areaHeight: number }
		return `${base}|${area.areaWidth},${area.areaHeight}`
	}
	return base
}

function getStorageKey(designProjectId: string, prefix = DEFAULT_STORAGE_KEY_PREFIX): string {
	return `${prefix}${designProjectId}`
}

/** 从 CanvasDesignStorageData 中解析并仅读写 markers 字段，兼容现有格式 */
export class MarkerStorage {
	private prefix: string
	private storage: Storage

	constructor(options: { prefix?: string; storage?: Storage } = {}) {
		this.prefix = options.prefix ?? DEFAULT_STORAGE_KEY_PREFIX
		this.storage =
			options.storage ?? (typeof window !== "undefined" ? localStorage : ({} as Storage))
	}

	getMarkers(designProjectId: string): Marker[] {
		const key = getStorageKey(designProjectId, this.prefix)
		try {
			const stored = this.storage.getItem(key)
			if (!stored) return []
			const data = JSON.parse(stored) as MarkerStorageData
			return Array.isArray(data?.markers) ? data.markers : []
		} catch {
			return []
		}
	}

	/** 获取 marker 关联的 ImageElement src 缓存（markerId -> src） */
	getMarkerElementSrc(designProjectId: string): Record<string, string> {
		const key = getStorageKey(designProjectId, this.prefix)
		try {
			const stored = this.storage.getItem(key)
			if (!stored) return {}
			const data = JSON.parse(stored) as MarkerStorageData
			return data?.markerElementSrc ?? {}
		} catch {
			return {}
		}
	}

	/** 获取 marker 合成图上传路径缓存（markerId -> { filePath, invalidationKey }） */
	getMarkerCompositePath(designProjectId: string): Record<string, CompositePathCacheEntry> {
		const key = getStorageKey(designProjectId, this.prefix)
		try {
			const stored = this.storage.getItem(key)
			if (!stored) return {}
			const data = JSON.parse(stored) as MarkerStorageData
			return data?.markerCompositePath ?? {}
		} catch {
			return {}
		}
	}

	saveMarkers(
		designProjectId: string,
		markers: Marker[],
		markerElementSrc?: Record<string, string>,
	): void {
		const key = getStorageKey(designProjectId, this.prefix)
		try {
			let existingData: MarkerStorageData = {}
			const stored = this.storage.getItem(key)
			if (stored) {
				existingData = JSON.parse(stored) as MarkerStorageData
			}
			const newData: MarkerStorageData = {
				...existingData,
				markers,
			}
			if (markerElementSrc !== undefined) {
				newData.markerElementSrc = markerElementSrc
			}
			this.storage.setItem(key, JSON.stringify(newData))
		} catch {
			//
		}
	}

	/** 保存单个 marker 的合成图上传路径缓存 */
	saveMarkerCompositePath(
		designProjectId: string,
		markerId: string,
		entry: CompositePathCacheEntry,
	): void {
		const key = getStorageKey(designProjectId, this.prefix)
		try {
			let existingData: MarkerStorageData = {}
			const stored = this.storage.getItem(key)
			if (stored) {
				existingData = JSON.parse(stored) as MarkerStorageData
			}
			const existing = existingData.markerCompositePath ?? {}
			const newComposite = { ...existing, [markerId]: entry }
			const newData: MarkerStorageData = {
				...existingData,
				markerCompositePath: newComposite,
			}
			this.storage.setItem(key, JSON.stringify(newData))
		} catch {
			//
		}
	}

	/** 修剪合成路径缓存，仅保留 validMarkerIds 中的 marker */
	pruneMarkerCompositePath(designProjectId: string, validMarkerIds: Set<string>): void {
		const key = getStorageKey(designProjectId, this.prefix)
		try {
			const stored = this.storage.getItem(key)
			if (!stored) return
			const data = JSON.parse(stored) as MarkerStorageData
			const composite = data?.markerCompositePath ?? {}
			if (Object.keys(composite).length === 0) return
			const pruned = Object.fromEntries(
				Object.entries(composite).filter(([id]) => validMarkerIds.has(id)),
			)
			if (Object.keys(pruned).length === Object.keys(composite).length) return
			this.storage.setItem(key, JSON.stringify({ ...data, markerCompositePath: pruned }))
		} catch {
			//
		}
	}
}
