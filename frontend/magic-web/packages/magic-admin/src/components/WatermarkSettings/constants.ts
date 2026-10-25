import type { PlatformWatermarkField, PlatformWatermarkIntensity } from "@admin/types/platformInfo"

/**
 * 水印字段的展示与渲染顺序。
 *
 * 管理页选项、预览拼接和前台实际水印渲染必须使用同一顺序，
 * 因此这里作为唯一来源，供表单、预览与页面归一化逻辑共用。
 */
export const WATERMARK_FIELD_ORDER = [
	"real_name",
	"employee_no",
	"visit_time",
	"department",
	"phone",
	"email",
] as const satisfies readonly PlatformWatermarkField[]

/** 水印深浅档位，取值与后端枚举 `light` / `standard` / `strong` 一致。 */
export const WATERMARK_DEPTH_OPTIONS = [
	"light",
	"standard",
	"strong",
] as const satisfies readonly PlatformWatermarkIntensity[]

/**
 * 归一化后端返回的字段列表。
 *
 * 后端只校验「非空字符串且 <=64 字符」，不校验枚举，脏值可能已经落库；
 * 这里丢弃未知值并按 {@link WATERMARK_FIELD_ORDER} 重排，避免脏数据进入表单与提交体。
 * 空数组是合法值（表示不展示任何字段），不会被兜底成默认字段。
 */
export function normalizeWatermarkFields(fields: unknown): PlatformWatermarkField[] {
	if (!Array.isArray(fields)) return []
	return WATERMARK_FIELD_ORDER.filter((field) => fields.includes(field))
}

/** 归一化深浅档位；后端对非法值按 `light` 处理，前端保持一致。 */
export function normalizeWatermarkDepth(depth: unknown): PlatformWatermarkIntensity {
	return WATERMARK_DEPTH_OPTIONS.find((option) => option === depth) ?? "light"
}
