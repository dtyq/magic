import type { AssetItem, StartAssetComplianceParams } from "@/apis"

/**
 * 素材库弹窗发起合规：仅使用列表/详情中的 file_key（与接口文档 POST /assets 一致）。
 */
export function buildAssetComplianceParamsFromAssetItem(
	asset: Pick<AssetItem, "name" | "file_key">,
): StartAssetComplianceParams | null {
	const name = asset.name?.trim()
	const fileKey = asset.file_key?.trim()
	if (!name || !fileKey) return null
	return {
		asset_kind: "ASSET",
		name,
		file_key: fileKey,
	}
}
