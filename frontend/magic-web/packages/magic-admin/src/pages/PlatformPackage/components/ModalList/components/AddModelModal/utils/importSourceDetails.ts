import type { TFunction } from "i18next"
import { AiManage } from "@admin/types/aiManage"
import { AiModel } from "@admin/const/aiModel"
import type { ImportSourceModel } from "../utils"
import { getModelTypeGroup } from "../utils"

export type ImportSourceDetailFieldType = "text" | "icon" | "multiline"

export interface ImportSourceDetailField {
	key: string
	label: string
	value: string
	type?: ImportSourceDetailFieldType
}

export interface ImportSourceDetailSection {
	key: string
	title: string
	fields: ImportSourceDetailField[]
}

const formatNumber = (value?: number | null) => {
	if (value === null || value === undefined) return "-"
	return String(value)
}

const getModelTypeLabel = (source: ImportSourceModel, t: TFunction) => {
	const options = getModelTypeGroup(t, source.category)
	const matched = options.find((item) => item.value === source.model_type)
	return matched?.label ?? String(source.model_type ?? "-")
}

const getTemperatureFields = (
	source: ImportSourceModel,
	t: TFunction,
): ImportSourceDetailField[] => {
	const { config } = source
	if (source.model_type === AiModel.ModelTypeGroup.Embedding) {
		return []
	}

	const fields: ImportSourceDetailField[] = []

	if (config.creativity !== null && config.creativity !== undefined) {
		fields.push({
			key: "creativity",
			label: t("form.recommendedTemperature"),
			value: formatNumber(config.creativity),
		})
	} else if (config.temperature !== null && config.temperature !== undefined) {
		fields.push({
			key: "temperature",
			label: t("form.fixedTemperature"),
			value: formatNumber(config.temperature),
		})
	}

	return fields
}

const getLlmParamFields = (source: ImportSourceModel, t: TFunction): ImportSourceDetailField[] => {
	if (source.category !== AiModel.ServiceProviderCategory.LLM) {
		return []
	}

	const { config } = source
	const configAny = config as AiManage.ModelInfo["config"] & {
		vector_size?: number
	}

	if (source.model_type === AiModel.ModelTypeGroup.Embedding) {
		return [
			{
				key: "vector_size",
				label: t("form.vectorSize"),
				value: formatNumber(configAny.vector_size),
			},
		]
	}

	return [
		{
			key: "max_tokens",
			label: t("form.maxContext"),
			value: formatNumber(config.max_tokens),
		},
		{
			key: "max_output_tokens",
			label: t("form.maxOutPutContext"),
			value: formatNumber(config.max_output_tokens),
		},
		...getTemperatureFields(source, t),
	]
}

/** 构建导入来源卡片的展开详情分组 */
export const getImportSourceDetailSections = (
	source: ImportSourceModel,
	t: TFunction,
): ImportSourceDetailSection[] => {
	const sections: ImportSourceDetailSection[] = []

	// 基本信息
	const basicFields: ImportSourceDetailField[] = [
		{
			key: "icon",
			label: t("form.modelDisplayIcon"),
			value: source.icon || "-",
			type: source.icon ? "icon" : "text",
		},
		{
			key: "model_type",
			label: t("form.modelType"),
			value: getModelTypeLabel(source, t),
		},
	]

	if (source.description) {
		basicFields.push({
			key: "description",
			label: t("form.modelDescription"),
			value: source.description,
			type: "multiline",
		})
	}

	if (basicFields.length > 0) {
		sections.push({
			key: "basic",
			title: t("form.importSourceSectionBasic"),
			fields: basicFields,
		})
	}

	// 模型参数
	const paramFields = getLlmParamFields(source, t)
	if (paramFields.length > 0) {
		sections.push({
			key: "params",
			title: t("form.importSourceSectionParams"),
			fields: paramFields,
		})
	}

	return sections
}
