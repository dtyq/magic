// @ts-nocheck
/**
 * DSL转换器API
 * 提供DSL和JSON之间转换的API
 */

import { DSLConverter } from "../dsl"

/**
 * 转换DSL到JSON
 * @param dslString DSL字符串(YAML格式)
 * @returns JSON对象或null
 */
export const convertDSLToJSON = (dslString: string) => {
	try {
		return DSLConverter.dslToJson(dslString)
	} catch (error: any) {
		console.error("DSL转JSON失败:", error.message)
		return null
	}
}

/**
 * 转换JSON到DSL
 * @param jsonObj JSON对象
 * @returns DSL字符串(YAML格式)或null
 */
export const convertJSONToDSL = (jsonObj: any) => {
	try {
		return DSLConverter.jsonToDslString(jsonObj)
	} catch (error: any) {
		console.error("JSON转DSL失败:", error.message)
		return null
	}
}

/**
 * 转换JSON字符串到DSL
 * @param jsonString JSON字符串
 * @returns DSL字符串(YAML格式)或null
 */
export const convertJSONStringToDSL = (jsonString: string) => {
	try {
		return DSLConverter.jsonStringToDslString(jsonString)
	} catch (error: any) {
		console.error("JSON字符串转DSL失败:", error.message)
		return null
	}
}

/**
 * 转换DSL到JSON字符串
 * @param dslString DSL字符串(YAML格式)
 * @returns JSON字符串或null
 */
export const convertDSLToJSONString = (dslString: string) => {
	try {
		return DSLConverter.dslToJsonString(dslString)
	} catch (error: any) {
		console.error("DSL转JSON字符串失败:", error.message)
		return null
	}
}

export default {
	convertDSLToJSON,
	convertJSONToDSL,
	convertJSONStringToDSL,
	convertDSLToJSONString,
}
