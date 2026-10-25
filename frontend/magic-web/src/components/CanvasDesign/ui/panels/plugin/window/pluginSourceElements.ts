import { getCanvasResourceReferenceIdentity } from "../../../../runtime/shared/path/canvasResourcePath"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"
import type { PluginCanvasClipboardPayload, PluginFileAsset } from "./types"

// 宿主侧、单插件窗口内的临时映射：插件只感知文件/path/id，落点算法需要原始画布元素 id。
// 这里不扩展插件协议，避免把画布内部元素 id 变成插件必须理解的字段。
export type PluginSourceElementMap = Map<string, string>

/**
 * 获取源元素 key。
 *
 * @param value - 原始输入 key
 * @returns 源元素 key
 */
function getSourceKeys(
	value: unknown,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string[] {
	if (typeof value !== "string") return []
	const trimmed = value.trim()
	if (!trimmed) return []
	if (!resolveResourceReference) return [trimmed]

	const identity = getCanvasResourceReferenceIdentity(trimmed, resolveResourceReference)
	return identity ? [identity] : []
}

/** 按单个文件/path/id key 登记来源画布元素。 */
export function registerPluginSourceElementByKey(
	sourceElementByAssetKey: PluginSourceElementMap | undefined,
	key: unknown,
	elementId: unknown,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (!sourceElementByAssetKey) return
	if (typeof elementId !== "string" || !elementId.trim()) return
	getSourceKeys(key, resolveResourceReference).forEach((sourceKey) => {
		sourceElementByAssetKey.set(sourceKey, elementId)
	})
}

/** 把插件文件资产可流转的多个字段都注册到同一个来源元素上。 */
export function registerPluginFileAssetSource(
	sourceElementByAssetKey: PluginSourceElementMap | undefined,
	asset: PluginFileAsset | undefined,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (!asset?.sourceElementId) return
	const elementId = asset.sourceElementId
	registerPluginSourceElementByKey(
		sourceElementByAssetKey,
		asset.path,
		elementId,
		resolveResourceReference,
	)
	registerPluginSourceElementByKey(
		sourceElementByAssetKey,
		asset.id,
		elementId,
		resolveResourceReference,
	)
	registerPluginSourceElementByKey(
		sourceElementByAssetKey,
		asset.src,
		elementId,
		resolveResourceReference,
	)
	registerPluginSourceElementByKey(
		sourceElementByAssetKey,
		asset.url,
		elementId,
		resolveResourceReference,
	)
}

/** 批量登记文件资产来源，并原样返回 assets 便于调用方继续透传。 */
export function registerPluginFileAssetSources(
	sourceElementByAssetKey: PluginSourceElementMap | undefined,
	assets: PluginFileAsset[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): PluginFileAsset[] {
	assets.forEach((asset) =>
		registerPluginFileAssetSource(sourceElementByAssetKey, asset, resolveResourceReference),
	)
	return assets
}

/** 登记画布剪贴板（copy-as-element） payload 中的元素 id 与 sourceRef，覆盖复制元素后在插件里生成的链路。 */
export function registerPluginClipboardSourceElements(
	sourceElementByAssetKey: PluginSourceElementMap | undefined,
	payload: PluginCanvasClipboardPayload | null,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	payload?.files.forEach((file) => {
		registerPluginSourceElementByKey(
			sourceElementByAssetKey,
			file.id,
			file.elementId,
			resolveResourceReference,
		)
		registerPluginSourceElementByKey(
			sourceElementByAssetKey,
			file.sourceRef?.src,
			file.elementId,
			resolveResourceReference,
		)
		registerPluginSourceElementByKey(
			sourceElementByAssetKey,
			file.sourceRef?.ossUrl,
			file.elementId,
			resolveResourceReference,
		)
	})
}

/**
 * 解析插件来源元素 ID。
 *
 * @param sourceElementByAssetKey - 插件来源元素映射
 * @param references - 原始输入 key
 * @returns 插件来源元素 ID
 */
export function resolvePluginSourceElementId(
	sourceElementByAssetKey: PluginSourceElementMap | undefined,
	references: unknown[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): string | undefined {
	if (!sourceElementByAssetKey) return undefined
	for (const reference of references) {
		for (const key of getSourceKeys(reference, resolveResourceReference)) {
			const elementId = sourceElementByAssetKey.get(key)
			if (elementId) return elementId
		}
	}
	return undefined
}

/**
 * 补充插件文件资产来源元素。
 *
 * @param sourceElementByAssetKey - 插件来源元素映射
 * @param assets - 插件文件资产
 * @returns 补充来源元素后的插件文件资产
 */
export function hydratePluginFileAssetSources(
	sourceElementByAssetKey: PluginSourceElementMap | undefined,
	assets: PluginFileAsset[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): PluginFileAsset[] {
	return assets.map((asset) => {
		// resolve-file-assets 可能按类型过滤结果，不能再依赖原始输入数组下标；只用返回 asset 自身的稳定 key 反查来源。
		const sourceElementId =
			asset.sourceElementId ||
			resolvePluginSourceElementId(
				sourceElementByAssetKey,
				[asset.path, asset.id, asset.src, asset.url],
				resolveResourceReference,
			)
		if (!sourceElementId) return asset
		const nextAsset = { ...asset, sourceElementId }
		registerPluginFileAssetSource(sourceElementByAssetKey, nextAsset, resolveResourceReference)
		return nextAsset
	})
}
