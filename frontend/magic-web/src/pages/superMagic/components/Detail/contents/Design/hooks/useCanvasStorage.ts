import { useMemo, useCallback } from "react"
import type {
	CanvasDesignStorageData,
	GenerateImageRequest,
	GenerateVideoRequest,
	StoredVideoModeDraftsMap,
	StoredVideoModeInputDraft,
} from "@/components/CanvasDesign/types.magic"
import { CanvasDesignRootStorageData } from "@/components/CanvasDesign/types.magic"
import { normalizeDesignStoragePathForCanvas } from "../utils/designDslPathUtils"

interface UseCanvasStorageOptions {
	designProjectId?: string
	designProjectBasePath?: string
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
	const { designProjectId, designProjectBasePath } = options

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
				return normalizeCanvasStorageData(
					JSON.parse(stored) as CanvasDesignStorageData,
					designProjectBasePath,
				)
			}
			return null
		} catch (error) {
			return null
		}
	}, [storageKey, designProjectBasePath])

	/**
	 * 保存存储数据
	 */
	const saveStorage = useCallback(
		(data: CanvasDesignStorageData): void => {
			if (!storageKey) {
				return
			}
			try {
				localStorage.setItem(
					storageKey,
					JSON.stringify(normalizeCanvasStorageData(data, designProjectBasePath)),
				)
			} catch (error) {
				//
			}
		},
		[storageKey, designProjectBasePath],
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

function normalizeCanvasStorageData(
	data: CanvasDesignStorageData,
	designProjectBasePath?: string,
): CanvasDesignStorageData {
	return {
		...data,
		tempImageConfigs: normalizeTempImageConfigs(data.tempImageConfigs, designProjectBasePath),
		tempVideoConfigs: normalizeTempVideoConfigs(data.tempVideoConfigs, designProjectBasePath),
		tempVideoModeDrafts: normalizeTempVideoModeDrafts(
			data.tempVideoModeDrafts,
			designProjectBasePath,
		),
	}
}

function normalizeTempImageConfigs(
	configs: CanvasDesignStorageData["tempImageConfigs"],
	designProjectBasePath?: string,
): CanvasDesignStorageData["tempImageConfigs"] {
	if (!configs) return configs

	return Object.fromEntries(
		Object.entries(configs).map(([elementId, config]) => [
			elementId,
			normalizeTempImageConfig(config, designProjectBasePath),
		]),
	)
}

function normalizeTempImageConfig(
	config: Partial<GenerateImageRequest>,
	designProjectBasePath?: string,
): Partial<GenerateImageRequest> {
	const referenceImageOptions = config.reference_image_options
	const normalizedReferenceImageOptions = referenceImageOptions?.length
		? referenceImageOptions.map((entry) => ({
				...entry,
				path: normalizeDesignStoragePathForCanvas(entry.path, designProjectBasePath),
			}))
		: undefined

	return {
		...config,
		reference_images: config.reference_images?.map((path) =>
			normalizeDesignStoragePathForCanvas(path, designProjectBasePath),
		),
		reference_image_options: normalizedReferenceImageOptions,
	}
}

function normalizeTempVideoConfigs(
	configs: CanvasDesignStorageData["tempVideoConfigs"],
	designProjectBasePath?: string,
): CanvasDesignStorageData["tempVideoConfigs"] {
	if (!configs) return configs

	return Object.fromEntries(
		Object.entries(configs).map(([elementId, config]) => [
			elementId,
			normalizeTempVideoConfig(config, designProjectBasePath),
		]),
	)
}

function normalizeTempVideoModeDrafts(
	drafts: CanvasDesignStorageData["tempVideoModeDrafts"],
	designProjectBasePath?: string,
): CanvasDesignStorageData["tempVideoModeDrafts"] {
	if (!drafts) return drafts

	return Object.fromEntries(
		Object.entries(drafts).map(([elementId, map]) => [
			elementId,
			normalizeSingleElementModeDrafts(map, designProjectBasePath),
		]),
	)
}

function normalizeSingleElementModeDrafts(
	map: StoredVideoModeDraftsMap | undefined,
	designProjectBasePath?: string,
): StoredVideoModeDraftsMap {
	if (!map) return {}

	const next: StoredVideoModeDraftsMap = { ...map }
	for (const key of ["keyframe_guided", "image_reference", "omni_reference"] as const) {
		const draft = map[key]
		if (!draft) continue
		next[key] = normalizeOneModeDraft(draft, designProjectBasePath)
	}
	return next
}

function normalizeOneModeDraft(
	draft: StoredVideoModeInputDraft,
	designProjectBasePath?: string,
): StoredVideoModeInputDraft {
	return {
		frameImageInfos: draft.frameImageInfos.map((slot) =>
			slot
				? {
						...slot,
						path: normalizeDesignStoragePathForCanvas(slot.path, designProjectBasePath),
						src: slot.src
							? normalizeDesignStoragePathForCanvas(slot.src, designProjectBasePath)
							: slot.src,
					}
				: slot,
		),
		referenceImageInfos: draft.referenceImageInfos.map((info) => ({
			...info,
			path: normalizeDesignStoragePathForCanvas(info.path, designProjectBasePath),
			src: info.src
				? normalizeDesignStoragePathForCanvas(info.src, designProjectBasePath)
				: info.src,
		})),
	}
}

function normalizeTempVideoConfig(
	config: Partial<GenerateVideoRequest>,
	designProjectBasePath?: string,
): Partial<GenerateVideoRequest> {
	const inputs = config.inputs
	if (!inputs) return config

	return {
		...config,
		inputs: {
			...inputs,
			...(inputs.frames?.length
				? {
						frames: inputs.frames.map((item) => ({
							...item,
							uri: normalizeDesignStoragePathForCanvas(
								item.uri,
								designProjectBasePath,
							),
						})),
					}
				: {}),
			...(inputs.reference_images?.length
				? {
						reference_images: inputs.reference_images.map((item) => ({
							...item,
							uri: normalizeDesignStoragePathForCanvas(
								item.uri,
								designProjectBasePath,
							),
						})),
					}
				: {}),
			...(inputs.reference_videos?.length
				? {
						reference_videos: inputs.reference_videos.map((item) => ({
							...item,
							uri: normalizeDesignStoragePathForCanvas(
								item.uri,
								designProjectBasePath,
							),
						})),
					}
				: {}),
			...(inputs.reference_audios?.length
				? {
						reference_audios: inputs.reference_audios.map((item) => ({
							...item,
							uri: normalizeDesignStoragePathForCanvas(
								item.uri,
								designProjectBasePath,
							),
						})),
					}
				: {}),
			...(inputs.video?.uri
				? {
						video: {
							...inputs.video,
							uri: normalizeDesignStoragePathForCanvas(
								inputs.video.uri,
								designProjectBasePath,
							),
						},
					}
				: {}),
			...(inputs.mask?.uri
				? {
						mask: {
							...inputs.mask,
							uri: normalizeDesignStoragePathForCanvas(
								inputs.mask.uri,
								designProjectBasePath,
							),
						},
					}
				: {}),
			...(inputs.audio?.length
				? {
						audio: inputs.audio.map((item) => ({
							...item,
							uri: normalizeDesignStoragePathForCanvas(
								item.uri,
								designProjectBasePath,
							),
						})),
					}
				: {}),
		},
	}
}
