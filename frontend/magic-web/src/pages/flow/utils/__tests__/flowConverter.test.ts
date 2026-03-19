import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { FlowConverter } from "../flowConverter"

describe.skip("测试 FlowConverter", () => {
	// 测试简单案例的JSON和YAML互转
	describe("简单案例测试", () => {
		const simpleJson = {
			id: "MAGIC-FLOW-test",
			name: "简单测试",
			nodes: [{ id: "node-1", type: "1" }],
			edges: [],
		}

		it("应能将简单JSON对象转为YAML字符串", () => {
			const yaml = FlowConverter.jsonToYamlString(simpleJson)
			expect(yaml).toBeDefined()
			expect(yaml.includes("id: MAGIC-FLOW-test")).toBe(true)
			expect(yaml.includes("name: 简单测试")).toBe(true)
		})

		it("应能将YAML字符串转回JSON对象，保持数据一致", () => {
			const yaml = FlowConverter.jsonToYamlString(simpleJson)
			const jsonFromYaml = FlowConverter.yamlToJson(yaml)

			// 检查基本字段
			expect(jsonFromYaml.id).toBe(simpleJson.id)
			expect(jsonFromYaml.name).toBe(simpleJson.name)
			expect(Array.isArray(jsonFromYaml.nodes)).toBe(true)
			expect(Array.isArray(jsonFromYaml.edges)).toBe(true)
		})
	})

	// 测试小型完整案例
	describe("小型完整案例测试", () => {
		let smallJson: any

		// 读取测试数据
		beforeEach(() => {
			const filePath = path.resolve(
				__dirname,
				"../../components/FlowAssistant/all_flow_nodes_small.json",
			)
			const fileContent = fs.readFileSync(filePath, "utf-8")
			smallJson = JSON.parse(fileContent)
		})

		it("应能将小型JSON对象转换为YAML并保持数据完整性", () => {
			// JSON转YAML
			const yaml = FlowConverter.jsonToYamlString(smallJson)
			expect(yaml).toBeDefined()

			// YAML转回JSON
			const jsonFromYaml = FlowConverter.yamlToJson(yaml)

			// 检查基本信息
			expect(jsonFromYaml.id).toBe(smallJson.id)
			expect(jsonFromYaml.name).toBe(smallJson.name)
			expect(jsonFromYaml.description).toBe(smallJson.description)
			expect(jsonFromYaml.type).toBe(smallJson.type)

			// 检查节点数量和基本信息
			expect(jsonFromYaml.nodes.length).toBe(smallJson.nodes.length)
			expect(jsonFromYaml.nodes[0].id).toBe(smallJson.nodes[0].id)
			expect(jsonFromYaml.nodes[0].node_type).toBe(smallJson.nodes[0].node_type)
			expect(jsonFromYaml.nodes[0].name).toBe(smallJson.nodes[0].name)

			// 检查边
			expect(jsonFromYaml.edges.length).toBe(smallJson.edges.length)
			expect(jsonFromYaml.edges[0].source).toBe(smallJson.edges[0].source)
			expect(jsonFromYaml.edges[0].target).toBe(smallJson.edges[0].target)

			// 检查全局变量
			expect(jsonFromYaml.global_variable).toBeDefined()
			if (smallJson.global_variable && jsonFromYaml.global_variable) {
				expect(jsonFromYaml.global_variable.variables[0].name).toBe(
					smallJson.global_variable.variables[0].name,
				)
				expect(jsonFromYaml.global_variable.variables[0].default_value).toBe(
					smallJson.global_variable.variables[0].default_value,
				)
			}
		})

		it("转换后的YAML应能转回JSON并与原始JSON匹配", () => {
			// 1. JSON -> YAML
			const yaml = FlowConverter.jsonToYamlString(smallJson)

			// 2. YAML -> JSON
			const convertedJson = FlowConverter.yamlToJson(yaml)

			// 3. 再次转换: YAML -> JSON -> YAML，确保多次转换的稳定性
			const secondYaml = FlowConverter.jsonToYamlString(convertedJson)
			const secondJson = FlowConverter.yamlToJson(secondYaml)

			// 检查关键属性是否保持一致
			function checkObjectEquality(original: any, converted: any, path = "") {
				// 检查基本信息
				expect(converted.id, `${path}.id`).toBe(original.id)
				expect(converted.name, `${path}.name`).toBe(original.name)

				// 检查节点匹配
				expect(converted.nodes.length, `${path}.nodes.length`).toBe(original.nodes.length)
				for (let i = 0; i < original.nodes.length; i++) {
					expect(converted.nodes[i].id, `${path}.nodes[${i}].id`).toBe(
						original.nodes[i].id,
					)
					expect(converted.nodes[i].node_type, `${path}.nodes[${i}].node_type`).toBe(
						original.nodes[i].node_type,
					)
				}

				// 检查边匹配
				expect(converted.edges.length, `${path}.edges.length`).toBe(original.edges.length)
				for (let i = 0; i < original.edges.length; i++) {
					expect(converted.edges[i].source, `${path}.edges[${i}].source`).toBe(
						original.edges[i].source,
					)
					expect(converted.edges[i].target, `${path}.edges[${i}].target`).toBe(
						original.edges[i].target,
					)
				}
			}

			// 检查一次转换的一致性
			checkObjectEquality(smallJson, convertedJson, "first-conversion")

			// 检查二次转换的一致性
			checkObjectEquality(convertedJson, secondJson, "second-conversion")
		})
	})

	// 测试API接口
	describe("测试API接口方法", () => {
		const testJson = {
			id: "test",
			name: "test",
			nodes: [{ id: "node1" }],
			edges: [],
		}
		const testYaml = `flow:
  id: test
  name: test
variables: []
nodes:
  - id: node1
edges: []`

		it("jsonToYamlString 方法应正常工作", () => {
			const yaml = FlowConverter.jsonToYamlString(testJson)
			expect(yaml).toBeDefined()
			expect(typeof yaml).toBe("string")
		})

		it("yamlToJsonString 方法应正常工作", () => {
			const json = FlowConverter.yamlToJsonString(testYaml)
			expect(json).toBeDefined()
			expect(typeof json).toBe("string")
			// 应该是有效的JSON字符串
			expect(() => JSON.parse(json)).not.toThrow()
		})

		it("jsonStringToYamlString 方法应正常工作", () => {
			const jsonString = JSON.stringify(testJson)
			const yaml = FlowConverter.jsonStringToYamlString(jsonString)
			expect(yaml).toBeDefined()
			expect(typeof yaml).toBe("string")
		})
	})

	// 测试边界情况和错误处理
	describe("边界情况和错误处理", () => {
		it("处理空对象", () => {
			const emptyJson = {}
			expect(() => FlowConverter.jsonToYamlString(emptyJson)).not.toThrow()
		})

		it("处理字段缺失的对象", () => {
			const incompleteJson = { id: "test" } // 没有必需的nodes和edges字段
			expect(() => FlowConverter.jsonToYamlString(incompleteJson)).not.toThrow()
		})
	})
})
