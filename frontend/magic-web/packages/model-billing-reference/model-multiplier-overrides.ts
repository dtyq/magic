/** 单个前台逻辑模型的展示倍率，独立于服务商、动态路由和结算。 */
export interface ModelMultiplierOverride {
	model_id: string
	multiplier: string
}

/** 与服务端共用十二位精度边界，不接受零、指数或非法数值。 */
export function isValidModelMultiplier(value: string): boolean {
	return /^\d{1,12}(?:\.\d{1,12})?$/.test(value) && /[1-9]/.test(value)
}

/** 更新同一逻辑模型，保留当前不可见项；清空表示删除该模型的覆盖。 */
export function updateModelMultiplierOverrides(
	overrides: ModelMultiplierOverride[] | undefined,
	modelId: string,
	value: string,
): ModelMultiplierOverride[] {
	const rest = (overrides ?? []).filter((item) => item.model_id !== modelId)
	return value === "" ? rest : [...rest, { model_id: modelId, multiplier: value }]
}

/** 保存前统一校验集合，避免折叠行中的错误值绕过表单校验。 */
export function areModelMultiplierOverridesValid(overrides: ModelMultiplierOverride[]): boolean {
	const seen = new Set<string>()
	return overrides.every(({ model_id, multiplier }) => {
		if (
			!model_id ||
			model_id.trim() !== model_id ||
			seen.has(model_id) ||
			!isValidModelMultiplier(multiplier)
		)
			return false
		seen.add(model_id)
		return true
	})
}

/** 最终预览仅使用合法手动值，非法草稿不伪装成自动结果。 */
export function getDisplayModelMultiplier(
	manual: string | undefined,
	calculated: string | null | undefined,
): string {
	if (manual === undefined) return calculated ?? "—"
	if (!isValidModelMultiplier(manual)) return "—"
	return Number(manual) < 0.01 ? "<0.01x" : `${Number(manual).toFixed(2)}x`
}
