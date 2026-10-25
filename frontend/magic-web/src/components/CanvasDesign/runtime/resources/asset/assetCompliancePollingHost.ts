import { AssetsApi } from "@/apis"
import type { Canvas } from "../../core/Canvas"
import {
	CanvasAssetComplianceTaskManager,
	type CanvasAssetComplianceTaskHost,
} from "./CanvasAssetComplianceTaskManager"
import { CanvasAssetCompliancePollingManager } from "./CanvasAssetCompliancePollingManager"
import { toCanvasAssetComplianceState } from "./assetComplianceState"

export interface AssetCompliancePollingHost {
	assetCompliancePollingManager: CanvasAssetCompliancePollingManager
}

let fallbackPollingManager: CanvasAssetCompliancePollingManager | null = null

function getFallbackPollingManager(): CanvasAssetCompliancePollingManager {
	if (!fallbackPollingManager) {
		fallbackPollingManager = new CanvasAssetCompliancePollingManager({
			magicConfigManager: {
				config: {
					methods: {
						getAssetComplianceStatus: async (assetId: string) => {
							const response = await AssetsApi.getAssetCompliance(assetId)
							return toCanvasAssetComplianceState(response)
						},
						getAssetComplianceStatuses: async (assetIds: string[]) => {
							try {
								const responses = await AssetsApi.batchGetAssetCompliance({
									asset_ids: assetIds,
								})
								return responses.map(toCanvasAssetComplianceState)
							} catch {
								return Promise.all(
									assetIds.map(async (assetId) => {
										const response = await AssetsApi.getAssetCompliance(assetId)
										return toCanvasAssetComplianceState(response)
									}),
								)
							}
						},
					},
				},
			},
		} as never)
	}
	return fallbackPollingManager
}

/** 素材库弹窗等场景可能没有 Canvas，此时复用同一套轮询实现。 */
export function resolveAssetCompliancePollingHost(
	canvas?: Canvas | null,
): AssetCompliancePollingHost {
	if (canvas && !canvas.isDestroyed) {
		return canvas
	}
	return { assetCompliancePollingManager: getFallbackPollingManager() }
}

let fallbackTaskManager: CanvasAssetComplianceTaskManager | null = null

const fallbackTaskHost: CanvasAssetComplianceTaskHost = {
	get assetCompliancePollingManager() {
		return getFallbackPollingManager()
	},
	assetResourceManager: {
		getCachedResource: () => undefined,
		refreshResources: async () => new Map(),
	} as unknown as CanvasAssetComplianceTaskHost["assetResourceManager"],
	elementManager: {
		getAllElements: () => [],
	} as unknown as CanvasAssetComplianceTaskHost["elementManager"],
}

function getFallbackTaskManager(): CanvasAssetComplianceTaskManager {
	if (!fallbackTaskManager) {
		fallbackTaskManager = new CanvasAssetComplianceTaskManager(fallbackTaskHost)
	}
	return fallbackTaskManager
}

/** 优先使用 Canvas 上的任务管理器；测试或未挂载 Canvas 时走模块级 fallback。 */
export function resolveAssetComplianceTaskManager(
	canvas?: Canvas | null,
): CanvasAssetComplianceTaskManager {
	if (canvas && !canvas.isDestroyed) {
		return canvas.assetComplianceTaskManager
	}
	return getFallbackTaskManager()
}
