import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { yaml2json, yamlString2json, yamlString2jsonString } from "../yaml2json"
import { json2yamlString } from "../flow2yaml"

describe.skip("测试 yaml2json 模块", () => {
	// 测试基础YAML转换
	describe("基础YAML转换", () => {
		it("应正确将基本YAML对象转换为Flow对象", () => {
			const yamlDSL = {
				flow: {
					id: "test-flow-id",
					name: "测试流程",
					description: "测试描述",
					version: "1.0.0",
					type: "workflow",
					icon: "test-icon",
					enabled: true,
				},
				variables: [],
				nodes: [],
				edges: [],
			}

			const flow = yaml2json(yamlDSL)

			// 检查基本信息
			expect(flow.id).toBe(yamlDSL.flow.id)
			expect(flow.name).toBe(yamlDSL.flow.name)
			expect(flow.description).toBe(yamlDSL.flow.description)
			expect(flow.version_code).toBe(yamlDSL.flow.version)
			expect(flow.type).toBe(1) // workflow应该转为1
			expect(flow.enabled).toBe(yamlDSL.flow.enabled)
			expect(Array.isArray(flow.nodes)).toBe(true)
			expect(Array.isArray(flow.edges)).toBe(true)
		})

		it("应正确处理不同类型的流程", () => {
			const chatDSL = {
				flow: {
					id: "test-flow-id",
					name: "测试流程",
					description: "测试描述",
					version: "1.0.0",
					type: "chat", // 聊天类型
					icon: "test-icon",
					enabled: true,
				},
				variables: [],
				nodes: [],
				edges: [],
			}

			const flow = yaml2json(chatDSL)

			// 检查流程类型
			expect(flow.type).toBe(2) // chat应该转为2
		})
	})

	// 测试节点转换
	describe("节点转换", () => {
		it("应正确转换节点类型", () => {
			const yamlWithNodes = {
				flow: {
					id: "test-flow-id",
					name: "测试流程",
					description: "测试描述",
					version: "1.0.0",
					type: "workflow",
				},
				variables: [],
				nodes: [
					{
						id: "node-1",
						type: "start",
						name: "开始节点",
						position: { x: 100, y: 100 },
						params: {},
						version: "v1",
						next_nodes: [],
					},
					{
						id: "node-2",
						type: "llm",
						name: "LLM节点",
						position: { x: 200, y: 100 },
						params: {
							model: "gpt-4",
							temperature: 0.7,
						},
						version: "v1",
						next_nodes: [],
					},
				],
				edges: [],
			}

			const flow = yaml2json(yamlWithNodes)

			// 检查节点
			expect(flow.nodes.length).toBe(2)
			expect(flow.nodes[0].node_type).toBe("1") // start应该转为1
			expect(flow.nodes[0].name).toBe("开始节点")

			expect(flow.nodes[1].node_type).toBe("2") // llm应该转为2
			expect(flow.nodes[1].name).toBe("LLM节点")
			expect(flow.nodes[1].params.model).toBe("gpt-4")
		})
	})

	// 测试边转换
	describe("边转换", () => {
		it("应正确转换边并添加默认样式", () => {
			const yamlWithEdges = {
				flow: {
					id: "test-flow-id",
					name: "测试流程",
					version: "1.0.0",
					type: "workflow",
				},
				variables: [],
				nodes: [],
				edges: [
					{
						id: "edge-1",
						source: "node-1",
						target: "node-2",
						sourceHandle: "output",
						targetHandle: "input",
					},
				],
			}

			const flow = yaml2json(yamlWithEdges)

			// 检查边
			expect(flow.edges.length).toBe(1)
			expect(flow.edges[0].id).toBe("edge-1")
			expect(flow.edges[0].source).toBe("node-1")
			expect(flow.edges[0].target).toBe("node-2")
			expect(flow.edges[0].sourceHandle).toBe("output")
			expect(flow.edges[0].targetHandle).toBe("input")
			expect(flow.edges[0].type).toBe("commonEdge")

			// 检查是否添加了默认样式
			expect(flow.edges[0].markerEnd).toBeDefined()
			expect(flow.edges[0].style).toBeDefined()
			expect(flow.edges[0].data).toBeDefined()
		})
	})

	// 测试全局变量转换
	describe("全局变量转换", () => {
		it("应正确转换全局变量", () => {
			const yamlWithVariables = {
				flow: {
					id: "test-flow-id",
					name: "测试流程",
					version: "1.0.0",
					type: "workflow",
				},
				variables: [
					{
						name: "testVar",
						type: "string",
						default: "test value",
						description: "A test variable",
					},
					{
						name: "numVar",
						type: "number",
						default: 123,
						description: "A number variable",
					},
				],
				nodes: [],
				edges: [],
			}

			const flow = yaml2json(yamlWithVariables)

			// 检查全局变量
			expect(flow.global_variable).toBeDefined()
			expect(flow.global_variable.variables.length).toBe(2)
			expect(flow.global_variable.variables[0].name).toBe("testVar")
			expect(flow.global_variable.variables[0].type).toBe("string")
			expect(flow.global_variable.variables[0].default_value).toBe("test value")
			expect(flow.global_variable.variables[0].description).toBe("A test variable")

			expect(flow.global_variable.variables[1].name).toBe("numVar")
			expect(flow.global_variable.variables[1].type).toBe("number")
			expect(flow.global_variable.variables[1].default_value).toBe(123)
		})

		it("应处理空变量列表", () => {
			const yamlWithoutVariables = {
				flow: {
					id: "test-flow-id",
					name: "测试流程",
					version: "1.0.0",
					type: "workflow",
				},
				variables: [],
				nodes: [],
				edges: [],
			}

			const flow = yaml2json(yamlWithoutVariables)

			// 检查全局变量为null
			expect(flow.global_variable).toBeNull()
		})
	})

	// 测试YAML字符串解析
	describe("YAML字符串解析", () => {
		it("应正确解析YAML字符串", () => {
			const yamlString = `
flow:
  id: test-flow-id
  name: 测试流程
  description: 测试描述
  version: 1.0.0
  type: workflow
  icon: test-icon
  enabled: true
variables: []
nodes: []
edges: []
      `

			const flow = yamlString2json(yamlString)

			// 检查基本信息
			expect(flow.id).toBe("test-flow-id")
			expect(flow.name).toBe("测试流程")
			expect(flow.description).toBe("测试描述")
			expect(flow.version_code).toBe("1.0.0")
			expect(flow.type).toBe(1)
			expect(flow.icon).toBe("test-icon")
			expect(flow.enabled).toBe(true)
		})

		it("应处理格式错误的YAML字符串并抛出错误", () => {
			const invalidYamlString = "invalid yaml: [\n]test:"

			expect(() => yamlString2json(invalidYamlString)).toThrow()
		})
	})

	// 测试YAML到JSON字符串转换
	describe("YAML到JSON字符串转换", () => {
		it("应正确将YAML字符串转换为JSON字符串", () => {
			const yamlString = `
flow:
  id: test-flow-id
  name: 测试流程
  description: 测试描述
  version: 1.0.0
  type: workflow
variables: []
nodes: []
edges: []
      `

			const jsonString = yamlString2jsonString(yamlString)

			// 检查JSON字符串
			expect(jsonString).toBeDefined()
			expect(typeof jsonString).toBe("string")

			// 解析回对象检查
			const parsedJson = JSON.parse(jsonString)
			expect(parsedJson.id).toBe("test-flow-id")
			expect(parsedJson.name).toBe("测试流程")
			expect(parsedJson.description).toBe("测试描述")
			expect(parsedJson.type).toBe(1)
		})
	})

	// 测试JSON->YAML->JSON循环转换
	describe("转换循环测试", () => {
		it("应能在JSON->YAML->JSON转换中保持数据完整性", () => {
			// 创建测试数据
			const originalJson = {
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
						type: "commonEdge",
					},
				],
				nodes: [
					{
						id: "node-1",
						node_id: "node-1",
						node_type: "1",
						node_version: "v1",
						name: "开始节点",
						position: { x: 100, y: 100 },
						params: {},
						meta: {},
						next_nodes: ["node-2"],
						step: 0,
						data: {},
						system_output: null,
					},
					{
						id: "node-2",
						node_id: "node-2",
						node_type: "2",
						node_version: "v1",
						name: "LLM节点",
						position: { x: 200, y: 100 },
						params: { model: "gpt-4" },
						meta: {},
						next_nodes: [],
						step: 0,
						data: {},
						system_output: null,
					},
				],
				global_variable: {
					variables: [
						{
							name: "testVar",
							type: "string",
							default_value: "test value",
							description: "A test variable",
						},
					],
				},
				enabled: true,
				version_code: "1.0.0",
			}

			// JSON -> YAML
			const yamlString = json2yamlString(originalJson)

			// YAML -> JSON
			const convertedJson = yamlString2json(yamlString)

			// 检查关键属性
			expect(convertedJson.id).toBe(originalJson.id)
			expect(convertedJson.name).toBe(originalJson.name)
			expect(convertedJson.description).toBe(originalJson.description)
			expect(convertedJson.type).toBe(originalJson.type)

			// 检查节点
			expect(convertedJson.nodes.length).toBe(originalJson.nodes.length)
			expect(convertedJson.nodes[0].id).toBe(originalJson.nodes[0].id)
			expect(convertedJson.nodes[0].node_type).toBe(originalJson.nodes[0].node_type)
			expect(convertedJson.nodes[1].id).toBe(originalJson.nodes[1].id)
			expect(convertedJson.nodes[1].node_type).toBe(originalJson.nodes[1].node_type)
			expect(convertedJson.nodes[1].params.model).toBe(originalJson.nodes[1].params.model)

			// 检查边
			expect(convertedJson.edges.length).toBe(originalJson.edges.length)
			expect(convertedJson.edges[0].source).toBe(originalJson.edges[0].source)
			expect(convertedJson.edges[0].target).toBe(originalJson.edges[0].target)

			// 检查全局变量
			expect(convertedJson.global_variable).toBeDefined()
			expect(convertedJson.global_variable.variables[0].name).toBe(
				originalJson.global_variable.variables[0].name,
			)
			expect(convertedJson.global_variable.variables[0].default_value).toBe(
				originalJson.global_variable.variables[0].default_value,
			)
		})
	})

	// 测试与实际小型案例的转换
	describe("小型实际案例测试", () => {
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

		it("应能正确进行JSON->YAML->JSON转换并保持数据完整性", () => {
			// JSON -> YAML
			const yamlString = json2yamlString(smallJson)

			// YAML -> JSON
			const convertedJson = yamlString2json(yamlString)

			// 检查基本信息
			expect(convertedJson.id).toBe(smallJson.id)
			expect(convertedJson.name).toBe(smallJson.name)
			expect(convertedJson.description).toBe(smallJson.description)
			expect(convertedJson.type).toBe(smallJson.type)

			// 检查节点数量和内容
			expect(convertedJson.nodes.length).toBe(smallJson.nodes.length)
			expect(convertedJson.nodes[0].id).toBe(smallJson.nodes[0].id)
			expect(convertedJson.nodes[0].node_type).toBe(smallJson.nodes[0].node_type)
			expect(convertedJson.nodes[0].name).toBe(smallJson.nodes[0].name)

			expect(convertedJson.nodes[1].id).toBe(smallJson.nodes[1].id)
			expect(convertedJson.nodes[1].node_type).toBe(smallJson.nodes[1].node_type)
			expect(convertedJson.nodes[1].name).toBe(smallJson.nodes[1].name)

			// 检查LLM节点的参数
			const originalLLM = smallJson.nodes.find((n: any) => n.node_type === "2")
			const convertedLLM = convertedJson.nodes.find((n: any) => n.node_type === "2")
			expect(convertedLLM.params.model).toBe(originalLLM.params.model)
			expect(convertedLLM.params.user_prompt).toBe(originalLLM.params.user_prompt)
			expect(convertedLLM.params.system_prompt).toBe(originalLLM.params.system_prompt)

			// 检查边
			expect(convertedJson.edges.length).toBe(smallJson.edges.length)
			expect(convertedJson.edges[0].source).toBe(smallJson.edges[0].source)
			expect(convertedJson.edges[0].target).toBe(smallJson.edges[0].target)

			// 检查全局变量
			if (smallJson.global_variable && convertedJson.global_variable) {
				expect(convertedJson.global_variable.variables[0].name).toBe(
					smallJson.global_variable.variables[0].name,
				)
				expect(convertedJson.global_variable.variables[0].default_value).toBe(
					smallJson.global_variable.variables[0].default_value,
				)
			}
		})
	})
})
