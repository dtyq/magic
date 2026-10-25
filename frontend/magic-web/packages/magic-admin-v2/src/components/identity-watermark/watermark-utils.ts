/**
 * 身份水印的字段词汇表、档位与归一化 / 预览工具。
 *
 * 平台级（平台管理 - 基础设置 - 平台信息 - 水印设置）与企业组织级（企业管理 -
 * 企业信息 - 水印信息）使用同一套配置项与渲染口径，因此把这些"水印词汇表"
 * 放在跨 feature 的共享目录，避免两处各自维护字段顺序或归一化规则而产生漂移。
 */

/** 身份水印中可展示的用户信息字段，取值与后端 `watermark.fields` 一致。 */
export type IdentityWatermarkField =
	| "real_name"
	| "employee_no"
	| "visit_time"
	| "department"
	| "phone"
	| "email";

/** 身份水印的深浅档位，取值与后端 `watermark.depth` 一致。 */
export type IdentityWatermarkDepth = "light" | "standard" | "strong";

/** 身份水印配置，后端只返回 enabled、fields、depth 三个字段。 */
export type IdentityWatermarkValue = {
	enabled: boolean;
	fields: IdentityWatermarkField[];
	depth: IdentityWatermarkDepth;
};

/**
 * 可选水印内容与展示顺序。这个 `as const` 元组同时作为类型约束、界面渲染顺序
 * 和归一化顺序的唯一来源，避免多处维护同一份字段清单。
 */
export const identityWatermarkFields = [
	"real_name",
	"employee_no",
	"visit_time",
	"department",
	"phone",
	"email",
] as const satisfies readonly IdentityWatermarkField[];

/** 水印深浅档位顺序，与后端 `watermark.depth` 一致。 */
export const identityWatermarkDepths = [
	"light",
	"standard",
	"strong",
] as const satisfies readonly IdentityWatermarkDepth[];

/**
 * 预览层文字色需要与前台水印渲染保持一致，属于渲染参数而不是语义色，
 * 因此不能替换成主题 token。
 */
export const identityWatermarkDepthTextColors: Record<IdentityWatermarkDepth, string> = {
	light: "rgba(0, 0, 0, 0.03)",
	standard: "rgba(0, 0, 0, 0.045)",
	strong: "rgba(0, 0, 0, 0.06)",
};

/** 与后端平台水印、组织水印的归一化默认值保持一致。 */
export const defaultIdentityWatermark: IdentityWatermarkValue = {
	enabled: false,
	fields: ["real_name"],
	depth: "light",
};

/** 返回一份默认水印配置的深拷贝，避免调用方改到常量本身。 */
export function createDefaultIdentityWatermark(): IdentityWatermarkValue {
	return {
		...defaultIdentityWatermark,
		fields: [...defaultIdentityWatermark.fields],
	};
}

/**
 * 只保留前端能渲染的字段并按固定顺序输出，避免后端返回未知字段或乱序时
 * 复选框组出现无法取消的脏数据。显式的空数组会被保留（表示不展示任何字段），
 * 与"字段整体缺失"区分开。
 */
export function normalizeIdentityWatermarkFields(
	value?: readonly string[],
): IdentityWatermarkField[] {
	const selected = new Set(value ?? []);

	return identityWatermarkFields.filter((field) => selected.has(field));
}

/** 未知档位回退到默认档位，避免后端返回历史值时预览与表单出现非法状态。 */
export function normalizeIdentityWatermarkDepth(value?: string): IdentityWatermarkDepth {
	return identityWatermarkDepths.find((depth) => depth === value) ?? defaultIdentityWatermark.depth;
}

/**
 * 归一化服务端水印配置。缺省字段回退到默认值，保证预览态、编辑态
 * 与提交参数使用同一份结构。
 */
export function normalizeIdentityWatermark(
	value?: Partial<IdentityWatermarkValue> | null,
): IdentityWatermarkValue {
	if (!value) {
		return createDefaultIdentityWatermark();
	}

	return {
		enabled: value.enabled ?? defaultIdentityWatermark.enabled,
		fields: normalizeIdentityWatermarkFields(value.fields),
		depth: normalizeIdentityWatermarkDepth(value.depth),
	};
}

/**
 * 按固定顺序把已选水印内容拼成预览文案。
 * 未选择任何内容时返回空串，由调用方决定兜底文案。
 */
export function buildIdentityWatermarkPreviewText(
	fields: readonly IdentityWatermarkField[],
	samples: Record<IdentityWatermarkField, string>,
) {
	return fields
		.map((field) => samples[field].trim())
		.filter(Boolean)
		.join(" · ");
}
