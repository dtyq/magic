// @ts-nocheck
/**
 * Flow转换服务
 * 提供Flow YAML和JSON格式之间的互相转换功能
 */

import { json2yaml, json2yamlString } from "./flow2yaml"
import { yamlString2json, yamlString2jsonString } from "./yaml2json"
import * as yaml from "js-yaml"

/**
 * Flow转换器类
 */
export class FlowConverter {
	/**
	 * 将YAML字符串转换为Flow JSON对象
	 * @param yamlString YAML字符串
	 * @returns Flow JSON对象
	 */
	static yamlToJson(yamlString: string) {
		return yamlString2json(yamlString)
	}

	/**
	 * 将YAML字符串转换为Flow JSON字符串
	 * @param yamlString YAML字符串
	 * @returns Flow JSON字符串
	 */
	static yamlToJsonString(yamlString: string) {
		return yamlString2jsonString(yamlString)
	}

	/**
	 * 将Flow JSON对象转换为YAML对象
	 * @param json Flow JSON对象
	 * @returns YAML对象
	 */
	static jsonToYaml(json: any) {
		return json2yaml(json)
	}

	/**
	 * 将Flow JSON对象转换为YAML字符串
	 * @param json Flow JSON对象
	 * @returns YAML字符串
	 */
	static jsonToYamlString(json: any) {
		try {
			// 处理空对象或缺少必要字段的对象
			if (!json || Object.keys(json).length === 0) {
				// 返回基本空结构
				return yaml.dump({
					flow: {
						id: "",
						name: "",
						description: "",
						version: "1.0.0",
						type: "default",
					},
					variables: [],
					nodes: [],
					edges: [],
				})
			}

			// 处理缺少必要字段的对象
			if (!json.nodes || !json.edges) {
				const defaultJson = {
					flow: {
						id: json.id || "",
						name: json.name || "",
						description: json.description || "",
						version: json.version_code || "1.0.0",
						type: json.type
							? typeof json.type === "number"
								? json.type === 1
									? "workflow"
									: json.type === 2
										? "knowledge"
										: "default"
								: json.type
							: "default",
						icon: json.icon || "",
						enabled: json.enabled !== undefined ? json.enabled : true,
					},
					variables: json.global_variable
						? Array.isArray(json.global_variable)
							? json.global_variable
							: []
						: [],
					nodes: json.nodes || [],
					edges: json.edges || [],
				}
				return yaml.dump(defaultJson, { lineWidth: -1, noRefs: true })
			}

			return json2yamlString(json)
		} catch (error) {
			console.error("转换JSON到YAML字符串失败:", error)
			// 返回基本空结构而不是抛出错误
			return yaml.dump({
				flow: {
					id: "",
					name: "",
					description: "",
					version: "1.0.0",
					type: "default",
				},
				variables: [],
				nodes: [],
				edges: [],
			})
		}
	}

	/**
	 * 将Flow JSON字符串转换为YAML字符串
	 * @param jsonString Flow JSON字符串
	 * @returns YAML字符串
	 */
	static jsonStringToYamlString(jsonString: string) {
		try {
			const json = JSON.parse(jsonString)
			return this.jsonToYamlString(json)
		} catch (error) {
			console.error("将JSON字符串转换为YAML字符串时发生错误:", error)
			// 返回基本空结构而不是抛出错误
			return yaml.dump({
				flow: {
					id: "",
					name: "",
					description: "",
					version: "1.0.0",
					type: "default",
				},
				variables: [],
				nodes: [],
				edges: [],
			})
		}
	}

	/**
	 * 将Flow JSON字符串转换为Flow JSON对象
	 * @param jsonString Flow JSON字符串
	 * @returns Flow JSON对象
	 */
	static jsonStringToJson(jsonString: string) {
		return JSON.parse(jsonString)
	}
}

export default FlowConverter
