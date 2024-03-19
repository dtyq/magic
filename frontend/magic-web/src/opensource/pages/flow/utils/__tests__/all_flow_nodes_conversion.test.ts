import { describe, it, expect, beforeAll } from "vitest"
import fs from "fs"
import path from "path"
import FlowConverter from "../flowConverter"

// 因为这个测试处理大型JSON，可能会超时，所以增加超时时间
describe.skip("大型JSON转换测试", () => {
	let allFlowNodesJson: any

	// 读取大型测试数据
	beforeAll(() => {
		const filePath = path.resolve(
			__dirname,
			"../../components/FlowAssistant/all_flow_nodes.json",
		)
		const fileContent = fs.readFileSync(filePath, "utf-8")
		allFlowNodesJson = JSON.parse(fileContent)
	}, 10000) // 10秒超时

	it("应能够将大型Flow JSON转换为YAML并保持结构完整", () => {
		// JSON -> YAML
		const yaml = FlowConverter.jsonToYamlString(allFlowNodesJson)

		// 基本检查YAML字符串格式
		expect(yaml).toBeDefined()
		expect(typeof yaml).toBe("string")
		expect(yaml.includes("flow:")).toBe(true)
		expect(yaml.includes(`  id: ${allFlowNodesJson.id}`)).toBe(true)
		expect(yaml.includes(`  name: ${allFlowNodesJson.name}`)).toBe(true)

		// 写入文件以便手动检查
		const yamlOutputPath = path.resolve(
			__dirname,
			"../../components/FlowAssistant/all_flow_nodes.yaml",
		)
		fs.writeFileSync(yamlOutputPath, yaml)

		// YAML -> JSON (转换回来)
		const convertedJson = FlowConverter.yamlToJson(yaml)

		// 将转换后的JSON写入文件以便手动比较
		const jsonOutputPath = path.resolve(
			__dirname,
			"../../components/FlowAssistant/all_flow_nodes_converted.json",
		)
		fs.writeFileSync(jsonOutputPath, JSON.stringify(convertedJson, null, 2))

		// 基本信息比较
		expect(convertedJson.id).toBe(allFlowNodesJson.id)
		expect(convertedJson.name).toBe(allFlowNodesJson.name)
		expect(convertedJson.description).toBe(allFlowNodesJson.description)
		expect(convertedJson.type).toBe(allFlowNodesJson.type)

		// 检查节点数量
		expect(convertedJson.nodes.length).toBe(allFlowNodesJson.nodes.length)

		// 检查边数量
		expect(convertedJson.edges.length).toBe(allFlowNodesJson.edges.length)

		// 深入检查一些关键节点
		// 确保节点类型和ID都正确
		allFlowNodesJson.nodes.forEach((originalNode: any, index: number) => {
			const convertedNode = convertedJson.nodes.find((n: any) => n.id === originalNode.id)
			expect(convertedNode).toBeDefined()
			expect(convertedNode.node_type).toBe(originalNode.node_type)
			expect(convertedNode.name).toBe(originalNode.name)
		})

		// 检查边的连接关系
		allFlowNodesJson.edges.forEach((originalEdge: any, index: number) => {
			const convertedEdge = convertedJson.edges.find((e: any) => e.id === originalEdge.id)
			expect(convertedEdge).toBeDefined()
			expect(convertedEdge.source).toBe(originalEdge.source)
			expect(convertedEdge.target).toBe(originalEdge.target)
		})
	}, 30000) // 30秒超时

	it("转换结果应能成功运行", () => {
		// 完整转换流程: JSON -> YAML -> JSON
		const yaml = FlowConverter.jsonToYamlString(allFlowNodesJson)
		const convertedJson = FlowConverter.yamlToJson(yaml)

		// 验证是否能进行多次转换: JSON -> YAML -> JSON -> YAML -> JSON
		// 这个测试确保转换逻辑可以应用于转换后的结果
		const secondYaml = FlowConverter.jsonToYamlString(convertedJson)
		expect(secondYaml).toBeDefined()

		const secondJson = FlowConverter.yamlToJson(secondYaml)
		expect(secondJson).toBeDefined()

		// 验证二次转换后的关键信息
		expect(secondJson.id).toBe(allFlowNodesJson.id)
		expect(secondJson.name).toBe(allFlowNodesJson.name)
		expect(secondJson.nodes.length).toBe(allFlowNodesJson.nodes.length)
		expect(secondJson.edges.length).toBe(allFlowNodesJson.edges.length)
	}, 30000) // 30秒超时

	it("应能够处理节点中的复杂参数结构", () => {
		// JSON -> YAML -> JSON
		const yaml = FlowConverter.jsonToYamlString(allFlowNodesJson)
		const convertedJson = FlowConverter.yamlToJson(yaml)

		// 找一个具有复杂结构的节点进行比较
		const complexNodes = allFlowNodesJson.nodes.filter(
			(n: any) =>
				n.params &&
				((n.params.branches && n.params.branches.length > 0) || // 带分支的节点
					(n.params.model_config && Object.keys(n.params.model_config).length > 0)), // 带模型配置的节点
		)

		if (complexNodes.length > 0) {
			// 测试第一个复杂节点
			const originalComplexNode = complexNodes[0]
			const convertedComplexNode = convertedJson.nodes.find(
				(n: any) => n.id === originalComplexNode.id,
			)

			expect(convertedComplexNode).toBeDefined()

			// 检查节点结构
			// function compareObjects(original: any, converted: any, path = "") {
			// 	// 检查对象类型
			// 	expect(typeof converted).toBe(typeof original)

			// 	if (original === null || typeof original !== "object") {
			// 		expect(converted).toEqual(original)
			// 		return
			// 	}

			// 	// 对于数组
			// 	if (Array.isArray(original)) {
			// 		expect(Array.isArray(converted)).toBe(true)
			// 		expect(converted.length).toBe(original.length)
			// 		original.forEach((item, i) => {
			// 			compareObjects(item, converted[i], `${path}[${i}]`)
			// 		})
			// 		return
			// 	}

			// 	// 对于对象
			// 	const originalKeys = Object.keys(original)
			// 	const convertedKeys = Object.keys(converted)

			// 	// 检查关键属性
			// 	originalKeys.forEach((key) => {
			// 		// 只比较重要属性，忽略边缘情况
			// 		if (
			// 			original[key] !== undefined &&
			// 			original[key] !== null &&
			// 			typeof original[key] !== "function"
			// 		) {
			// 			const keyPath = path ? `${path}.${key}` : key

			// 			// 对于某些特定的属性，可能结构会不同，但核心信息应该保持一致
			// 			// 例如，当转换后的对象可能有些额外属性或缺少某些非关键属性
			// 			if (convertedKeys.includes(key)) {
			// 				compareObjects(original[key], converted[key], keyPath)
			// 			}
			// 		}
			// 	})
			// }

			// 比较params结构中的关键部分
			if (originalComplexNode.params.branches) {
				expect(convertedComplexNode.params.branches).toBeDefined()
				expect(convertedComplexNode.params.branches.length).toBe(
					originalComplexNode.params.branches.length,
				)

				// 检查第一个分支的关键属性
				if (originalComplexNode.params.branches.length > 0) {
					const originalBranch = originalComplexNode.params.branches[0]
					const convertedBranch = convertedComplexNode.params.branches[0]

					expect(convertedBranch.branch_id).toBe(originalBranch.branch_id)
					expect(convertedBranch.trigger_type).toBe(originalBranch.trigger_type)
				}
			}

			if (originalComplexNode.params.model_config) {
				expect(convertedComplexNode.params.model_config).toBeDefined()
				// 检查模型配置的关键参数
				Object.keys(originalComplexNode.params.model_config).forEach((key) => {
					expect(convertedComplexNode.params.model_config[key]).toBe(
						originalComplexNode.params.model_config[key],
					)
				})
			}
		}
	}, 30000) // 30秒超时
})
