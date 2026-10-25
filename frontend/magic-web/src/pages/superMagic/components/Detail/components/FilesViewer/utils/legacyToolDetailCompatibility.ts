import { DetailType } from "../../../types"

/**
 * 历史 ToolDetail 兼容版本。
 *
 * 版本号不是旧数据中的字段，而是根据旧数据留下的结构特征推断出来的。
 * 这样做是为了让兼容逻辑具备可叠加的边界：以后出现新的历史格式时，
 * 可以新增版本和对应分支，而不是继续把条件追加到同一个布尔表达式里。
 */
export const LEGACY_TOOL_DETAIL_COMPATIBILITY_VERSION = {
	V1: "v1",
} as const

export type LegacyToolDetailCompatibilityVersion =
	(typeof LEGACY_TOOL_DETAIL_COMPATIBILITY_VERSION)[keyof typeof LEGACY_TOOL_DETAIL_COMPATIBILITY_VERSION]

interface LegacyToolDetail {
	type?: string
	data?: Record<string, unknown>
}

/**
 * 兼容历史工具消息详情中的「工具内容文件」。
 *
 * 背景：早期 magic-service 会把较大的工具输出内容落盘到 topic 文件，
 * 但不会在 ToolDetail.data 中写入 storage_type，也不会写入项目附件树使用的
 * relative_file_path。后续 magic-web 增加了 workspace 文件删除校验后，
 * 这些旧详情会因为 file_id 不在项目附件列表中而被误认为已删除。
 *
 * 这段逻辑只识别旧协议留下的窄场景，不参与正常文件类型推断，也不修改详情内容：
 * - 仅处理文本类详情，避免影响图片、Browser、Office 等其他预览；
 * - 必须存在 file_id 和 file_name，说明内容曾经被文件化保存；
 * - 必须缺少 storage_type 和 relative_file_path，排除新协议及明确的 workspace 文件；
 * - content 必须已经被清空，符合工具内容落盘后的历史数据形态。
 *
 * 版本识别与具体兼容行为分开：
 * - `resolveLegacyToolContentDetailVersion()` 只负责回答“这是什么历史格式”；
 * - `shouldPreserveLegacyToolContentDetail()` 根据版本决定是否跳过删除判断。
 *
 * 返回 true 后，调用方应保留原始详情并跳过 workspace 附件树删除判断。
 * 该函数独立存在，后续删除历史兼容时只需移除调用点和本文件，不会污染主预览流程。
 */
export function resolveLegacyToolContentDetailVersion(
	detail: LegacyToolDetail,
): LegacyToolDetailCompatibilityVersion | null {
	if (matchesVersionV1(detail)) {
		return LEGACY_TOOL_DETAIL_COMPATIBILITY_VERSION.V1
	}

	return null
}

export function shouldPreserveLegacyToolContentDetail(detail: LegacyToolDetail): boolean {
	const version = resolveLegacyToolContentDetailVersion(detail)

	switch (version) {
		case LEGACY_TOOL_DETAIL_COMPATIBILITY_VERSION.V1:
			return true
		default:
			return false
	}
}

/**
 * V1 历史格式：工具输出已落盘到 topic 文件，但详情没有记录存储类型和 workspace 路径。
 *
 * 这个匹配器只描述 V1，不要在这里混入后续版本的字段。新版本应新增自己的匹配器，
 * 再由 `resolveLegacyToolContentDetailVersion()` 按明确顺序识别。
 */
function matchesVersionV1(detail: LegacyToolDetail): boolean {
	const data = detail.data
	if (!data) return false

	const isTextDetail = [DetailType.Text, DetailType.Md, DetailType.Code].includes(
		detail.type as DetailType,
	)
	if (!isTextDetail) return false

	const hasFileId =
		(typeof data.file_id === "string" && data.file_id.trim().length > 0) ||
		(typeof data.file_id === "number" && Number.isFinite(data.file_id))
	const hasFileName = typeof data.file_name === "string" && data.file_name.trim().length > 0
	const hasStorageType =
		typeof data.storage_type === "string" && data.storage_type.trim().length > 0
	const hasWorkspacePath =
		typeof data.relative_file_path === "string" && data.relative_file_path.trim().length > 0
	const contentWasCleared = data.content === null || data.content === ""

	return hasFileId && hasFileName && !hasStorageType && !hasWorkspacePath && contentWasCleared
}
