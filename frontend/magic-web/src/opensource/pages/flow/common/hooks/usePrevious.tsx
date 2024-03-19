/**
 * 各节点通用hooks，用于计算前置节点可引用的数据源
 */

import { cloneDeep, get, set, uniqBy } from "lodash-es"
import {
	useFlowData,
	useFlowEdges,
	useNodeConfig,
} from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import type { NodeSchema } from "@dtyq/magic-flow/dist/MagicFlow/register/node"
import { nodeManager } from "@dtyq/magic-flow/dist/MagicFlow/register/node"
import {
	schemaToDataSource,
	judgeIsVariableNode,
	getNodeVersion,
} from "@dtyq/magic-flow/dist/MagicFlow/utils"
import { getAllPredecessors } from "@dtyq/magic-flow/dist/MagicFlow/utils/reactflowUtils"
import type { DataSourceOption } from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/Reference"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { useNodeMap } from "@dtyq/magic-flow/dist/common/context/NodeMap/useResize"
import { useFlowStore } from "@/opensource/stores/flow"
import { DefaultNodeVersion } from "@dtyq/magic-flow/dist/MagicFlow/constants"
import { botStore } from "@/opensource/stores/bot"
import { InstructionType } from "@/opensource/types/bot"
import { useTranslation } from "react-i18next"
import { customNodeType, DynamicOutputNodeTypes } from "../../constants"
import { checkIsInLoop, mergeOptionsIntoOne } from "../../utils/helpers"
import { generateLoopItemOptions } from "./helpers"
import { LoopTypes } from "../../nodes/Loop/v0/components/LoopTypeSelect"

export default function usePrevious() {
	const { flow } = useFlowData()
	const { edges } = useFlowEdges()
	const { nodeConfig } = useNodeConfig()
	const { currentNode } = useCurrentNode()
	const { nodeMap: nodeSchemaMap } = useNodeMap()
	const { t } = useTranslation()
	const { methodsDataSource } = useFlowStore()

	const updateVariableOption = useMemoizedFn(
		(
			currentOptions: DataSourceOption[],
			curNode: MagicFlow.Node | any,
			pointerVariables?: Schema,
		) => {
			// 暂定有指定变量schema的情况下为环境变量
			const isGlobalVariable = !!pointerVariables

			const cloneOptions = cloneDeep(currentOptions)

			let variableOption = cloneOptions.find(
				(option) => option.nodeType === customNodeType.VariableSave,
			)

			const variables =
				pointerVariables || get(curNode, ["params", "variables", "form", "structure"], null)

			const id = isGlobalVariable ? "variables" : curNode.node_id

			const nodeVersion = getNodeVersion(curNode)

			const option = schemaToDataSource(
				{
					...nodeSchemaMap[customNodeType.VariableSave]?.[nodeVersion]?.schema,
					type: customNodeType.VariableSave,
					id,
					label: curNode?.name as string,
				},
				// @ts-ignore
				variables,
				true,
				isGlobalVariable,
			)

			/** 如果不存在变量选项了，则新增一个 */
			if (!variableOption) {
				variableOption = {
					...option,
					title: "变量",
				}
				// 推到第一个
				cloneOptions.unshift(variableOption as DataSourceOption)
			} else {
				// console.log("option", option)
				/** 针对相同变量名去重后的结果 */
				const uniqOptions = uniqBy(
					[...(variableOption.children || []), ...(option.children || [])],
					"key",
				)
				/** 否则往变量选项新增值 */
				set(variableOption, ["children"], uniqOptions)
			}

			return cloneOptions
		},
	)

	const filterCanReferenceNodes = useMemoizedFn((allNodes: MagicFlow.Node[]) => {
		const { canReferenceNodeTypes } = nodeManager
		return allNodes.filter((n) => {
			return canReferenceNodeTypes.includes(`${n.node_type}`)
		})
	})

	// 动态生成数据源
	const generateDynamicSource = useMemoizedFn(
		(outputs: Schema[], currentNodeSchema: NodeSchema, cur: MagicFlow.Node, suffix: string) => {
			return outputs.map((output) => {
				return schemaToDataSource(
					{
						...currentNodeSchema,
						type: currentNodeSchema.id,
						id: `${cur.node_id}${suffix}`,
						label: cur.name as string,
					},
					output,
				)
			})
		},
	)

	// 处理流程指令，生成数据源
	const generateInstructionsDataSource = useMemoizedFn(() => {
		// 如果没有指令数据或者当前节点不存在，则返回空数组
		if (!botStore.instructList?.length || !currentNode) return []

		// 获取流程指令（instruction_type为1的指令）
		const flowInstructions = botStore.instructList.flatMap((group) => {
			return group.items.filter(
				(item) => "instruction_type" in item && item.instruction_type === 1,
			)
		})

		if (!flowInstructions.length) return []

		// 创建指令数据源，使用any类型绕过类型检查
		const instructionsSchema: any = {
			type: "object",
			key: "instructs",
			sort: 0,
			title: t("flow:flowInstructions.flowInstructions"),
			description: "",
			required: [],
			value: null,
			encryption: false,
			encryption_value: "",
			items: undefined,
			properties: {},
		}

		// 针对不同类型的指令构建不同的schema
		flowInstructions.forEach((instruction) => {
			if ("type" in instruction) {
				// 根据指令类型创建不同的schema
				switch (instruction.type) {
					case InstructionType.SINGLE_CHOICE: {
						// 单选指令
						if ("values" in instruction) {
							// 创建一个对象，包含name和value两个属性
							const instructionObj: any = {
								type: "object",
								key: instruction.id,
								sort: 0,
								title: instruction.name,
								description: instruction.description || "",
								required: [],
								value: null,
								encryption: false,
								encryption_value: "",
								items: undefined,
								properties: {
									name: {
										type: "string",
										key: "name",
										sort: 0,
										title: `${t("flow:flowInstructions.instructionName")}`,
										description: t(
											"flow:flowInstructions.singleChoiceInstructionName",
										),
										required: [],
										value: null,
										encryption: false,
										encryption_value: "",
										items: undefined,
										properties: undefined,
									},
									value: {
										type: "string",
										key: "value",
										sort: 1,
										title: `${t("flow:flowInstructions.instructionValue")}`,
										description: t(
											"flow:flowInstructions.singleChoiceInstructionValue",
										),
										required: [],
										value: null,
										encryption: false,
										encryption_value: "",
										items: undefined,
										properties: undefined,
									},
								},
							}
							instructionsSchema.properties![instruction.id] = instructionObj
						}
						break
					}
					case InstructionType.SWITCH: {
						// 开关指令 - 同样包含name和value两个属性
						const instructionObj: any = {
							type: "object",
							key: instruction.id,
							sort: 0,
							title: instruction.name,
							description: instruction.description || "",
							required: [],
							value: null,
							encryption: false,
							encryption_value: "",
							items: undefined,
							properties: {
								name: {
									type: "string",
									key: "name",
									sort: 0,
									title: `${t("flow:flowInstructions.instructionStatus")}`,
									description: t("flow:flowInstructions.switchInstructionName"),
									required: [],
									value: null,
									encryption: false,
									encryption_value: "",
									items: undefined,
									properties: undefined,
								},
								value: {
									type: "string",
									key: "value",
									sort: 1,
									title: `${t("flow:flowInstructions.instructionValue")}`,
									description: t("flow:flowInstructions.switchInstructionValue"),
									required: [],
									value: null,
									encryption: false,
									encryption_value: "",
									items: undefined,
									properties: undefined,
								},
							},
						}
						instructionsSchema.properties![instruction.id] = instructionObj
						break
					}
					default:
						// 默认情况下不处理其他类型
						break
				}
			}
		})

		// 只有当存在有效的流程指令时才生成数据源
		if (Object.keys(instructionsSchema.properties!).length === 0) return []

		// 生成指令数据源
		const instructionsDataSource = schemaToDataSource(
			{
				...nodeSchemaMap[customNodeType.Instructions]?.v0?.schema,
				type: customNodeType.Instructions,
				id: "instructions",
				label: t("flow:flowInstructions.flowInstructions"),
			},
			instructionsSchema,
			true,
			true, // 全局级别
		)

		return [instructionsDataSource]
	})

	const expressionDataSource = useMemo(() => {
		if (!currentNode) return []
		const nodes = Object.values(nodeConfig)
		let allPreNodes = getAllPredecessors(currentNode, nodes, edges)
		// 如果是循环体内的节点，可引用的数据源为当前节点的上文节点+循环体的上文节点
		if (checkIsInLoop(currentNode)) {
			const loopBodyNode = nodeConfig?.[currentNode?.meta?.parent_id]
			const loopBodyAllPrevNodes = getAllPredecessors(loopBodyNode, nodes, edges)
			allPreNodes = [...loopBodyAllPrevNodes, ...allPreNodes]
		}
		// 过滤出不需要被引用的节点
		allPreNodes = filterCanReferenceNodes(allPreNodes)
		// 根据id去重
		const uniquePreNodes = uniqBy(allPreNodes, "node_id")
		// console.log(currentNode?.node_id, allPreNodes)
		let expressionSources = uniquePreNodes.reduce((acc, cur) => {
			let output = [cur?.output?.form]
			let systemOutputs = [cur?.system_output?.form?.structure]
			let customSystemOutputs = [cur?.custom_system_output?.form?.structure]

			// 如果是分支节点，则需要从branches拿output
			if (nodeManager.branchNodeIds.includes(`${cur.node_type}`)) {
				// getAllPredecessors计算了outputBranchIds，也就是A->B，A的分支id列表
				output = cur?.params?.outputBranchIds?.map((branchId: string) => {
					const targetBranch = cur?.params?.branches?.find(
						(branch: any) => branch.branch_id === branchId,
					)
					// 处理分支级别的系统输出
					// @ts-ignore
					systemOutputs.push(targetBranch?.system_output?.form?.structure)
					// @ts-ignore
					customSystemOutputs.push(targetBranch?.custom_system_output?.form?.structure)
					// 过滤掉空的输出
					return targetBranch?.output?.form
				})
			}
			// 过滤掉空的系统输出
			systemOutputs = systemOutputs.filter((systemOutput) => !!systemOutput)
			// 过滤掉空的自定义系统输出
			customSystemOutputs = customSystemOutputs.filter((systemOutput) => !!systemOutput)
			const nodeVersion = getNodeVersion(cur)
			const currentNodeSchema = get(
				nodeManager.nodesMap,
				[cur.node_type, nodeVersion, "schema"],
				null,
			)

			if (output.length === 0 || !currentNodeSchema) return acc

			//  A多个端点连线到B，需要通过分支进行分类
			if (output.length > 1) {
				const options = [] as DataSourceOption[]
				output?.forEach((branchOutput) => {
					let schema = branchOutput?.structure

					// 如果是动态生成output的节点，则取其output
					if (DynamicOutputNodeTypes.includes(cur?.node_type as customNodeType)) {
						schema = cur?.output?.form?.structure
					}
					if (!schema) return
					// 增加系统级输出
					if (systemOutputs.length > 0) {
						options.push(
							...generateDynamicSource(
								systemOutputs,
								currentNodeSchema,
								cur,
								"_system",
							),
						)
					}

					// 增加自定义系统级输出
					if (customSystemOutputs.length > 0) {
						options.push(
							...generateDynamicSource(
								customSystemOutputs,
								currentNodeSchema,
								cur,
								"_custom_system",
							),
						)
					}

					options.push(...generateDynamicSource([schema!], currentNodeSchema, cur, ""))
				})
				// 将多个A的分支输出合并后的结果
				const resultOption = mergeOptionsIntoOne(options)
				acc = [...acc, resultOption]
			}
			// A -> B只有一个端点的情况，不需要区分分支
			else {
				const options = [] as DataSourceOption[]
				let schema = output[0]?.structure
				/** 特殊处理变量类型节点，不再进行转换，而是统一归类到「变量下」 */
				const isVariableNode = judgeIsVariableNode(currentNodeSchema.id)

				if (!schema && !isVariableNode) return acc
				// 如果是动态生成output的节点，则取其output
				if (DynamicOutputNodeTypes.includes(cur?.node_type as customNodeType)) {
					schema = cur?.output?.form?.structure
				}
				if (!schema && !isVariableNode) return acc

				// 增加系统级输出数据源
				if (systemOutputs.length > 0) {
					options.push(
						...generateDynamicSource(systemOutputs, currentNodeSchema, cur, "_system"),
					)
				}
				// 增加自定义系统级输出
				if (customSystemOutputs.length > 0) {
					options.push(
						...generateDynamicSource(
							customSystemOutputs,
							currentNodeSchema,
							cur,
							"_custom_system",
						),
					)
				}

				if (isVariableNode) {
					acc = updateVariableOption(acc, cur)
				} else {
					options.push(...generateDynamicSource([schema!], currentNodeSchema, cur, ""))
					const resultOption = mergeOptionsIntoOne(options)
					acc = acc.concat(resultOption)
				}
			}

			return [...acc]
		}, [] as DataSourceOption[])

		// 如果是循环体内的节点，则需要手动在最前面新增硬编码的可饮用项item和index
		if (checkIsInLoop(currentNode)) {
			const loopBodyNode = nodeConfig?.[currentNode?.meta?.parent_id]
			const loopNode = nodeConfig?.[loopBodyNode?.meta?.parent_id]
			// 且循环类型为「循环数组」时
			const isLoopArrayType = loopNode?.params?.type === LoopTypes.Array
			if (loopNode && isLoopArrayType) {
				const extraLoopDataSource = generateLoopItemOptions(loopNode, nodeSchemaMap)
				expressionSources.unshift(extraLoopDataSource)
			}
		}

		// 如果存在环境变量，则需要重新更新数据源
		if (flow?.global_variable) {
			const variableSchema = get(
				nodeManager,
				["nodesMap", customNodeType.VariableSave, DefaultNodeVersion, "schema"],
				null,
			)
			// 确保variableSchema不为undefined再传入updateVariableOption
			if (variableSchema) {
				expressionSources = updateVariableOption(
					expressionSources,
					// @ts-ignore
					variableSchema,
					flow?.global_variable?.structure,
				)
			}
		}

		// 加入流程指令数据源
		const instructionsDataSource = generateInstructionsDataSource()
		if (instructionsDataSource.length > 0) {
			expressionSources.unshift(...instructionsDataSource)
		}

		// console.log("expressionDataSource", expressionSources)

		// 在最后把函数数据源添加进去
		expressionSources.push(...methodsDataSource)

		return expressionSources
	}, [
		currentNode,
		nodeConfig,
		edges,
		filterCanReferenceNodes,
		flow?.global_variable,
		generateInstructionsDataSource,
		methodsDataSource,
		generateDynamicSource,
		updateVariableOption,
		nodeSchemaMap,
	])

	return {
		expressionDataSource,
	}
}
