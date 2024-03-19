/**
 * 各节点通用hooks，用于计算前置节点可引用的数据源
 */

import { mockMethodsSource } from "@/MagicExpressionWidget/components/dataSource"
import { transformDataSource } from "@/MagicExpressionWidget/helpers"
import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { nodeManager } from "@/MagicFlow/register/node"
import { MagicFlow } from "@/MagicFlow/types/flow"
import {
	getNodeSchema,
	getNodeVersion,
	judgeIsVariableNode,
	schemaToDataSource,
} from "@/MagicFlow/utils"
import { getAllPredecessors } from "@/MagicFlow/utils/reactflowUtils"
import { Schema } from "@/MagicJsonSchemaEditor/components/editor/genson-js"
import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import { useMemo } from "react"
import { customNodeType } from "../../constants"

export default function usePrevious() {
	const { nodeConfig, edges, flow } = useFlow()
	const { currentNode } = useCurrentNode()

	const updateVariableOption = useMemoizedFn(
		(
			currentOptions: DataSourceOption[],
			currentNode: MagicFlow.Node,
			pointerVariables?: Schema,
		) => {
			// 暂定有指定变量schema的情况下为全局变量
			const isGlobalVariable = !!pointerVariables

			const cloneOptions = _.cloneDeep(currentOptions)

			let variableOption = cloneOptions.find(
				(option) => option.nodeType === customNodeType.VariableSave,
			)

			const variables =
				pointerVariables ||
				_.get(currentNode, ["params", "variables", "form", "structure"], null)

			const nodeSchema = getNodeSchema(
				customNodeType.VariableSave,
				getNodeVersion(currentNode),
			)

			const option = schemaToDataSource(
				{
					...nodeSchema,
					type: customNodeType.VariableSave,
					id: currentNode?.node_id,
					label: currentNode?.name as string,
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
				cloneOptions.unshift(variableOption)
			} else {
				/** 针对相同变量名去重后的结果 */
				const uniqOptions = _.uniqBy(
					[...(variableOption.children || []), ...(option.children || [])],
					"key",
				)
				/** 否则往变量选项新增值 */
				_.set(variableOption, ["children"], uniqOptions)
			}

			return cloneOptions
		},
	)

	// 将多个数据源项合并同类项，因为都属于同个节点
	const mergeOptionsIntoOne = useMemoizedFn((options: DataSourceOption[]): DataSourceOption => {
		return options.reduce((mergeResult, currentOption) => {
			const newChildren = [
				...(mergeResult.children || []),
				...(currentOption.children || []),
			] as DataSourceOption[]
			// 根据节点id和key进行去重后的结果
			const uniqueChildren = _.uniqBy(newChildren, (obj) => `${obj.nodeId}_${obj.key}`)
			mergeResult = {
				...mergeResult,
				...currentOption,
				children: uniqueChildren,
			}
			return mergeResult
		}, {} as DataSourceOption)
	})

	const expressionDataSource = useMemo(() => {
		if (!currentNode) return []
		const nodes = Object.values(nodeConfig)
		const allPreNodes = getAllPredecessors(currentNode, nodes, edges)
		// console.log(currentNode?.node_id, allPreNodes)
		let expressionSources = allPreNodes.reduce((acc, cur) => {
			let output = [cur?.output?.form]
			const systemOutput = cur?.system_output?.form?.structure
			// console.log("cur", cur)
			// 如果是分支节点，则需要从branches拿output
			if (nodeManager.branchNodeIds.includes(`${cur.node_type}`)) {
				// getAllPredecessors计算了outputBranchIds，也就是A->B，A的分支id列表
				output = cur?.params?.outputBranchIds?.map((branchId: string) => {
					return cur?.params?.branches?.find(
						(branch: any) => branch.branch_id === branchId,
					)?.output?.form
				})
			}

			const currentNodeSchema = getNodeSchema(cur.node_type, getNodeVersion(cur))

			if (output.length === 0 || !currentNodeSchema) return acc

			// TODO A多个端点连线到B，需要通过分支进行分类
			if (output.length > 1) {
			}
			// A -> B只有一个端点的情况，不需要区分分支
			else {
				const schema = output[0]?.structure
				const options = []
				/** 特殊处理变量类型节点，不再进行转换，而是统一归类到「变量下」 */
				const isVariableNode = judgeIsVariableNode(currentNodeSchema.id)

				if (!schema && !isVariableNode) return acc

				// 增加系统级输出
				if (systemOutput) {
					options.push(
						schemaToDataSource(
							{
								...currentNodeSchema,
								type: currentNodeSchema.id,
								id: `${cur.node_id}_system`,
								label: cur.name as string,
							},
							systemOutput,
						),
					)
				}

				if (isVariableNode) {
					acc = updateVariableOption(acc, cur)
				} else {
					options.push(
						schemaToDataSource(
							{
								...currentNodeSchema,
								type: currentNodeSchema.id,
								id: cur.node_id,
								label: cur.name as string,
							},
							schema!,
						),
					)
					// 将多个A的分支输出合并后的结果
					const resultOption = mergeOptionsIntoOne(options)
					acc = acc.concat(resultOption)
				}
			}

			return [...acc]
		}, [] as DataSourceOption[])

		// 如果存在全局变量，则需要重新更新数据源
		if (flow?.global_variable) {
			const variableSchema = _.get(
				nodeManager,
				["nodesMap", customNodeType.VariableSave, "schema"],
				null,
			)
			expressionSources = updateVariableOption(
				expressionSources,
				// @ts-ignore
				variableSchema,
				flow?.global_variable?.structure,
			)
		}

		// @ts-ignore
		expressionSources.push(...transformDataSource(mockMethodsSource))

		// console.log("expressionDataSource", expressionSources)

		return expressionSources
	}, [nodeConfig, edges, currentNode])

	return {
		expressionDataSource,
	}
}
