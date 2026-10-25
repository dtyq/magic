import type { ModelMultiplierOverride } from "./model-multiplier-overrides"
export * from "./model-multiplier-overrides"

/** 两个管理端共用的配置契约；默认值和最终参考金额由后端提供。 */
export interface ModelBillingMultiplierSettings {
	enabled: boolean
	model_overrides?: ModelMultiplierOverride[]
	base_price_cny: string | null
	currency?: "CNY" | "USD" | null
	input_price?: string | null
	output_price?: string | null
	usd_to_cny_rate: string | null
}

/** 两个后台保存同一套源字段，响应中的派生金额和未知字段不会进入写请求。 */
export function toModelMultiplierUpdate(value: ModelBillingMultiplierSettings) {
	return {
		enabled: value.enabled,
		...(value.model_overrides === undefined ? {} : { model_overrides: value.model_overrides }),
		currency: value.currency ?? "CNY",
		input_price: value.input_price ?? null,
		output_price: value.output_price ?? null,
		usd_to_cny_rate: value.usd_to_cny_rate,
	}
}

const DECIMAL_SCALE = 12
// 使用构造函数兼容既有构建目标，运行环境至少为支持 BigInt 的 Chrome 100。
const ZERO = BigInt(0)
const TEN = BigInt(10)

/** 按接口精度读取非负单价，不把空值、非法值当作零。 */
function readDecimal(value: string | null | undefined): bigint | null {
	if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,12})?$/.test(value)) return null
	const [integer, fraction = ""] = value.split(".")
	return BigInt(integer + fraction.padEnd(DECIMAL_SCALE, "0"))
}

/** 将定点金额还原为文本，预览不通过浮点数改写提交值。 */
function decimalText(value: bigint, scale: number): string {
	const digits = value.toString().padStart(scale + 1, "0")
	const fraction = digits.slice(-scale).replace(/0+$/, "")
	return digits.slice(0, -scale) + (fraction ? `.${fraction}` : "")
}

/** 固定输入一万、输出一千 token，结果使用十五位定点精度。 */
function referenceUnits(input: string | null | undefined, output: string | null | undefined) {
	const inputUnits = readDecimal(input)
	const outputUnits = readDecimal(output)
	return inputUnits === null || outputUnits === null ? null : inputUnits * TEN + outputUnits
}

/** 仅用于草稿预览，缺少任一单价时不填充业务默认值。 */
export function previewReferenceAmount(value: ModelBillingMultiplierSettings): string | null {
	const amount = referenceUnits(value.input_price, value.output_price)
	if (amount === null || amount <= ZERO) return null
	if (value.currency === "CNY") return decimalText(amount, 15)
	const rate = readDecimal(value.usd_to_cny_rate)
	return value.currency === "USD" && rate !== null && rate > ZERO
		? decimalText(amount * rate, 27)
		: null
}

/** 读取后端参考金额或编辑中的完整单价，两个模式分别遵循各自的数据来源。 */
export function getReferenceAmount(value: ModelBillingMultiplierSettings, editing: boolean) {
	return editing ? previewReferenceAmount(value) : value.base_price_cny
}

/** 只校验源单价和汇率，后端派生金额不能代替用户填写单价。 */
export function validateMultiplierSettings(value: ModelBillingMultiplierSettings) {
	const fields: ("input_price" | "output_price" | "usd_to_cny_rate" | "currency")[] = []
	const hasPrices = value.input_price != null || value.output_price != null
	if ((hasPrices || value.enabled) && value.currency !== "CNY" && value.currency !== "USD")
		fields.push("currency")
	if (hasPrices || value.enabled) {
		if (readDecimal(value.input_price) === null) fields.push("input_price")
		if (readDecimal(value.output_price) === null) fields.push("output_price")
		if (referenceUnits(value.input_price, value.output_price) === ZERO)
			fields.push("output_price")
	}
	const rate = readDecimal(value.usd_to_cny_rate)
	if ((value.enabled || value.usd_to_cny_rate != null) && (rate === null || rate === ZERO))
		fields.push("usd_to_cny_rate")
	return fields
}

export * from "./system-model-price-preview"
