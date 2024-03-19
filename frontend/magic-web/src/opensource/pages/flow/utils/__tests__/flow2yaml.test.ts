import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { json2yaml, json2yamlString, jsonStr2yamlString } from "../flow2yaml"

describe.skip("测试 flow2yaml 模块", () => {
	// 测试基础对象转换
	describe("基础对象转换", () => {
		it("应正确将基本Flow对象转换为DSL对象", () => {
			const basicFlow = {
				id: "test-flow-id",
				name: "测试流程",
				description: "测试描述",
				icon: "test-icon",
				type: 1,
				tool_set_id: "test-tool-set",
				edges: [],
				nodes: [],
				global_variable: null,
				enabled: true,
				version_code: "1.0.0",
			}

			const dsl = json2yaml(basicFlow)

			// 检查结构正确性
			expect(dsl.flow).toBeDefined()
			expect(dsl.flow.id).toBe(basicFlow.id)
			expect(dsl.flow.name).toBe(basicFlow.name)
			expect(dsl.flow.description).toBe(basicFlow.description)
			expect(dsl.flow.version).toBe(basicFlow.version_code)
			expect(dsl.flow.type).toBe("workflow") // 类型1应转为workflow
			expect(dsl.variables).toEqual([])
			expect(dsl.nodes).toEqual([])
			expect(dsl.edges).toEqual([])
		})

		it("应正确转换节点的类型名称", () => {
			const flowWithNodes = {
				id: "test-flow-id",
				name: "测试流程",
				description: "测试描述",
				icon: "test-icon",
				type: 1,
				tool_set_id: "test-tool-set",
				edges: [],
				nodes: [
					{
						id: "node-1",
						node_id: "node-1",
						node_type: "1", // 开始节点
						node_version: "v1",
						name: "开始节点",
						position: { x: 100, y: 100 },
						params: {},
						meta: {},
						next_nodes: [],
						step: 0,
						data: {},
						system_output: null,
					},
					{
						id: "node-2",
						node_id: "node-2",
						node_type: "2", // LLM节点
						node_version: "v1",
						name: "LLM节点",
						position: { x: 200, y: 100 },
						params: {},
						meta: {},
						next_nodes: [],
						step: 0,
						data: {},
						system_output: null,
					},
				],
				global_variable: null,
				enabled: true,
				version_code: "1.0.0",
			}

			const dsl = json2yaml(flowWithNodes)

			// 检查节点转换
			expect(dsl.nodes.length).toBe(2)
			expect(dsl.nodes[0].type).toBe("start")
			expect(dsl.nodes[1].type).toBe("llm")
		})
	})

	// 测试边的转换
	describe("边的转换", () => {
		it("应正确转换边的连接关系", () => {
			const flowWithEdges = {
				id: "test-flow-id",
				name: "测试流程",
				description: "测试描述",
				icon: "test-icon",
				type: 1,
				tool_set_id: "test-tool-set",
				edges: [
					{
						id: "edge-1",
						source: "node-1",
						target: "node-2",
						sourceHandle: "output",
						targetHandle: "input",
						type: "commonEdge",
						style: { stroke: "#000" },
						data: {},
					},
				],
				nodes: [],
				global_variable: null,
				enabled: true,
				version_code: "1.0.0",
			}

			const dsl = json2yaml(flowWithEdges)

			// 检查边转换
			expect(dsl.edges.length).toBe(1)
			expect(dsl.edges[0].id).toBe("edge-1")
			expect(dsl.edges[0].source).toBe("node-1")
			expect(dsl.edges[0].target).toBe("node-2")
			expect(dsl.edges[0].sourceHandle).toBe("output")
			expect(dsl.edges[0].targetHandle).toBe("input")
		})
	})

	// 测试全局变量转换
	describe("全局变量转换", () => {
		it("应正确转换全局变量", () => {
			const flowWithVariables = {
				id: "test-flow-id",
				name: "测试流程",
				description: "测试描述",
				icon: "test-icon",
				type: 1,
				tool_set_id: "test-tool-set",
				edges: [],
				nodes: [],
				global_variable: {
					variables: [
						{
							name: "testVar",
							type: "string",
							default_value: "test value",
							description: "A test variable",
						},
						{
							name: "numVar",
							type: "number",
							default_value: 123,
							description: "A number variable",
						},
					],
				},
				enabled: true,
				version_code: "1.0.0",
			}

			const dsl = json2yaml(flowWithVariables)

			// 检查变量转换
			expect(dsl.variables.length).toBe(2)
			expect(dsl.variables[0].name).toBe("testVar")
			expect(dsl.variables[0].type).toBe("string")
			expect(dsl.variables[0].default).toBe("test value")
			expect(dsl.variables[0].description).toBe("A test variable")

			expect(dsl.variables[1].name).toBe("numVar")
			expect(dsl.variables[1].type).toBe("number")
			expect(dsl.variables[1].default).toBe(123)
		})
	})

	// 测试字符串输出
	describe("YAML字符串生成", () => {
		it("应生成有效的YAML字符串", () => {
			const simpleFlow = {
				id: "test-flow-id",
				name: "测试流程",
				description: "测试描述",
				icon: "test-icon",
				type: 1,
				tool_set_id: "test-tool-set",
				edges: [],
				nodes: [],
				global_variable: null,
				enabled: true,
				version_code: "1.0.0",
			}

			const yamlString = json2yamlString(simpleFlow)

			// 检查YAML字符串格式
			expect(yamlString).toBeDefined()
			expect(typeof yamlString).toBe("string")
			expect(yamlString.includes("flow:")).toBe(true)
			expect(yamlString.includes("  id: test-flow-id")).toBe(true)
			expect(yamlString.includes("  name: 测试流程")).toBe(true)
			expect(yamlString.includes("  description: 测试描述")).toBe(true)
			expect(yamlString.includes("  type: workflow")).toBe(true)
		})
	})

	// 测试JSON字符串转换
	describe("JSON字符串转换", () => {
		it("应正确将JSON字符串转换为YAML字符串", () => {
			const jsonString = JSON.stringify({
				id: "test-flow-id",
				name: "测试流程",
				description: "测试描述",
				icon: "test-icon",
				type: 1,
				tool_set_id: "test-tool-set",
				edges: [],
				nodes: [],
				global_variable: null,
				enabled: true,
				version_code: "1.0.0",
			})

			const yamlString = jsonStr2yamlString(jsonString)

			// 检查YAML字符串
			expect(yamlString).toBeDefined()
			expect(typeof yamlString).toBe("string")
			expect(yamlString.includes("flow:")).toBe(true)
			expect(yamlString.includes("  id: test-flow-id")).toBe(true)
		})

		it("应处理无效的JSON字符串并抛出错误", () => {
			const invalidJsonString = "{invalid json}"

			expect(() => jsonStr2yamlString(invalidJsonString)).toThrow()
		})
	})

	// 测试与实际小型案例的转换
	describe("实际案例测试", () => {
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

		it("应能转换小型测试案例", () => {
			const yamlString = json2yamlString(smallJson)

			// 检查YAML字符串包含关键信息
			expect(yamlString.includes(`flow:`)).toBe(true)
			expect(yamlString.includes(`  id: ${smallJson.id}`)).toBe(true)
			expect(yamlString.includes(`  name: ${smallJson.name}`)).toBe(true)

			// 检查节点信息
			expect(yamlString.includes("nodes:")).toBe(true)
			expect(yamlString.includes("  - id: node-1")).toBe(true)
			expect(yamlString.includes("    type: start")).toBe(true)

			expect(yamlString.includes("  - id: node-2")).toBe(true)
			expect(yamlString.includes("    type: llm")).toBe(true)

			// 检查边信息
			expect(yamlString.includes("edges:")).toBe(true)
			expect(yamlString.includes("  - id: edge-1")).toBe(true)

			// 检查变量信息
			expect(yamlString.includes("variables:")).toBe(true)
			expect(yamlString.includes("  - name: 测试变量")).toBe(true)
		})
	})
})
