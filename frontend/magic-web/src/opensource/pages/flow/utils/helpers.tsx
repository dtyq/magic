import { Switch } from "antd"
import type { DataSourceOption } from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/Reference"
import { Common } from "@dtyq/magic-flow/dist/MagicConditionEdit/types/common"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import type { EXPRESSION_VALUE } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { FormItemType, LabelTypeMap } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type JSONSchema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { flowStore } from "@dtyq/magic-flow/dist/MagicFlow/store/index"
import type { NodeSchema } from "@dtyq/magic-flow/dist/MagicFlow"

import type { Sheet } from "@/opensource/types/sheet"
import { Schema } from "@/opensource/types/sheet"
import { get, last, isEmpty, isObject, isArray, cloneDeep, uniqBy, set, omitBy } from "lodash-es"
// @ts-ignore
import SnowFlakeId from "snowflake-id"
import i18next from "i18next"
import { useFlowStore } from "@/opensource/stores/flow"
import type { ComponentTypes, UseableToolSet } from "@/opensource/types/flow"
import { getLatestNodeVersion } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import { customNodeType } from "../constants"
import { shadow, unshadow } from "@/opensource/utils/shadow"
import { JsonSchemaEditorProps } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor"
import { getDefaultSchema } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/utils/SchemaUtils"
import { ContactApi } from "@/opensource/apis"
import { UserType } from "@/opensource/types/user"

// 雪花id生成
const snowflake = new SnowFlakeId({
	mid: Math.floor(Math.random() * 1e10),
	offset: (2021 - 1970) * 365 * 24 * 3600 * 1000,
})

/** 获取某个节点类型的节点schema */
export const getNodeSchema = (nodeType: string | number): NodeSchema => {
	const { nodeVersionSchema } = flowStore.getState()
	const version = getLatestNodeVersion(nodeType) as string
	return get(nodeVersionSchema, [nodeType, version, "schema"])
}

export const findFieldInDataSource = (
	fieldKeys: string[],
	dataSourceOptions: DataSourceOption[],
): DataSourceOption => {
	const [curKey, ...restKeys] = [...fieldKeys]
	const foundField = dataSourceOptions.find((option) => {
		// 拿到切割后的最后一个key，作为匹配值
		const lastKey = last((option?.key as string)?.split?.("."))
		return lastKey === curKey
	})
	if (restKeys.length === 0) {
		return foundField as DataSourceOption
	}
	return findFieldInDataSource(restKeys, foundField?.children as DataSourceOption[])
}

export function generateSnowFlake() {
	return snowflake.generate()
}

/** 检查是否在循环体内 */
export const checkIsInLoop = (node: MagicFlow.Node) => {
	return node?.meta?.parent_id
}

export const getComponent = (type: string) => {
	const componentMap = {
		[FormItemType.Number]: <MagicInput type="number" />,
		[FormItemType.String]: <MagicInput.TextArea />,
		[FormItemType.Boolean]: <Switch />,
		[FormItemType.Integer]: <MagicInput type="number" />,
		[FormItemType.Array]: <div>暂不支持选择数组</div>,
		[FormItemType.Object]: <div>暂不支持选择对象</div>,
	}
	return componentMap?.[type as FormItemType]
}

/**
 * 根据schema,转换为动态form item
 * @param schema json schema
 * @param namePrefix
 * @returns
 */
// export const generateFormItems = (schema?: Schema, namePrefix: string = "") => {
// 	if (!schema) return null

// 	// @ts-ignore
// 	const { type, properties, items, title, key: schemaKey } = schema

// 	const formTitle = title || schemaKey

// 	if (type === FormItemType.Object && properties) {
// 		const objectLabel = namePrefix ? "" : formTitle
// 		// 递归处理对象类型，嵌套的对象也会被正确处理
// 		return (
// 			<Form.Item label={objectLabel} className="object-wrapper" name={schemaKey}>
// 				{Object.keys(properties).map((key) => {
// 					const propertySchema = properties[key]
// 					const fieldName = namePrefix ? `${namePrefix}.${key}` : `${schemaKey}.${key}`
// 					return (
// 						<Form.Item label={key} key={fieldName} name={fieldName.split(".")}>
// 							{generateFormItems(propertySchema, fieldName)}
// 						</Form.Item>
// 					)
// 				})}
// 			</Form.Item>
// 		)
// 	}

// 	if (type === FormItemType.Array && items) {
// 		// 使用 Form.List 来处理数组，数组中的元素可能是对象或数组
// 		return (
// 			<Form.Item label={formTitle} className="array-wrapper">
// 				<Form.List name={namePrefix || schemaKey}>
// 					{(fields, { add, remove }) => {
// 						return (
// 							<div className="array-item">
// 								{fields.map(({ key, name }, index) => (
// 									<Flex
// 										justify="space-between"
// 										align="center"
// 										gap={10}
// 									>
// 										<Form.Item
// 											key={key}
// 											name={name}
// 											label={`${index}`}
// 											style={{ flex: 1 }}
// 										>
// 											{/* 对数组项进行递归处理 */}
// 											{generateFormItems(items, `${name}`)}
// 										</Form.Item>
// 										<IconTrash
// 											className="icon-trash"
// 											width={20}
// 											onClick={() => remove(name)}
// 										/>
// 									</Flex>
// 								))}
// 								<div className="add-btn" onClick={() => add()}>
// 									<IconPlus />
// 									<span className="text">新增一项</span>
// 								</div>
// 							</div>
// 						)
// 					}}
// 				</Form.List>
// 			</Form.Item>
// 		)
// 	}

// 	// 处理基本类型 (string, number, boolean 等)
// 	return componentMap?.[type as FormItemType]
// }

/**
 * 在schema里面寻找表达式块
 * @param properties
 * @param result
 * @returns
 */
export const searchExpressionFieldsInSchema = (
	schema: Record<string, JSONSchema>,
	result = [] as EXPRESSION_VALUE[],
) => {
	Object.values(schema?.properties || {}).forEach((subSchema) => {
		if (subSchema.type === FormItemType.Object) {
			searchExpressionFieldsInSchema(subSchema.properties || {}, result)
		}
		result.push(
			...(subSchema?.value?.expression_value || []),
			...(subSchema?.value?.const_value || []),
		)
	})
	return result.flat()
}

// 将多个数据源项合并同类项，因为都属于同个节点
export const mergeOptionsIntoOne = (options: DataSourceOption[]): DataSourceOption => {
	return options.reduce((mergeResult, currentOption) => {
		const newChildren = [
			...(mergeResult.children || []),
			...(currentOption.children || []),
		] as DataSourceOption[]
		// 根据节点id和key进行去重后的结果
		const uniqueChildren = uniqBy(newChildren, (obj) => `${obj.nodeId}_${obj.key}`)
		mergeResult = {
			...mergeResult,
			...currentOption,
			children: uniqueChildren,
		}
		return mergeResult
	}, {} as DataSourceOption)
}

export const getCurrentDateTimeString = () => {
	const now = new Date()
	const year = now.getFullYear()
	const month = String(now.getMonth() + 1).padStart(2, "0")
	const day = String(now.getDate()).padStart(2, "0")
	const hours = String(now.getHours()).padStart(2, "0")
	const minutes = String(now.getMinutes()).padStart(2, "0")
	// const seconds = String(now.getSeconds()).padStart(2, "0")

	return `${year}${month}${day}${hours}${minutes}`
}

/**
 * 将flow的所有代码节点值都进行混淆处理
 */
export const shadowFlow = (flow: MagicFlow.Flow) => {
	const cloneFlow = cloneDeep(flow)

	const allCodeNode = Object.values(cloneFlow.nodes).filter(
		(n) => n.node_type == customNodeType.Code,
	)

	allCodeNode.forEach((codeNode) => {
		const codeData = get(codeNode, ["params", "code"], "")
		set(codeNode, ["params", "code"], shadow(codeData))
	})

	return cloneFlow
}

/**
 * 将flow的所有代码节点值都进行解码处理
 */
export const unShadowFlow = (flow: MagicFlow.Flow) => {
	const cloneFlow = cloneDeep(flow)

	const allCodeNode = Object.values(cloneFlow.nodes).filter(
		(n) => n.node_type == customNodeType.Code,
	)

	allCodeNode.forEach((codeNode) => {
		const codeData = get(codeNode, ["params", "code"], "")
		set(codeNode, ["params", "code"], unshadow(codeData))
	})

	return cloneFlow
}

/**
 * 将代码节点进行混淆处理
 */
export const shadowNode = (node: MagicFlow.Node) => {
	const cloneNode = cloneDeep(node)
	const codeData = get(cloneNode, ["params", "code"], "")
	set(cloneNode, ["params", "code"], shadow(codeData))
	return cloneNode
}

export function removeEmptyValues(obj: Record<string, any>): Record<string, any> {
	return omitBy(
		obj,
		(value) => isEmpty(value) || (isObject(value) && !isArray(value) && isEmpty(value)),
	)
}

export const getExpressionPlaceholder = (str: string) => {
	return `${str}${i18next.t("common.allowExpressionPlaceholder", { ns: "flow" })}`
}

// 根据id查找到工具集对应的工具
export const findTargetTool = (id: string) => {
	const { useableToolSets } = useFlowStore.getState()
	const allTools = useableToolSets.reduce(
		(tools, currentToolSet) => {
			return tools.concat(
				currentToolSet.tools.map((tool) => ({
					...tool,
					icon: currentToolSet.icon,
				})),
			)
		},
		[] as (UseableToolSet.UsableTool & { icon: string })[],
	)
	return allTools.find((tool) => tool.code === id)
}

/**
 * 生成组件默认数据
 * @param componentType
 * @returns
 */
export function genDefaultComponent<ResultType extends Common.ComponentTypes>(
	componentType: ComponentTypes,
	structure: any = null,
): ResultType {
	const uniqueId = null
	const result = {
		id: uniqueId,
		type: componentType,
		version: "1",
		structure,
	}

	// @ts-ignore
	return result
}

/** 根据类型生成默认的schema，可以通过defaultProps新增一些其他属性或者覆盖默认属性 */
export const getDefaultSchemaWithDefaultProps = (
	type: string,
	defaultProps: Partial<JsonSchemaEditorProps>,
	itemsType?: string,
) => {
	return {
		...getDefaultSchema(type, itemsType),
		...defaultProps,
	}
}

// 根据字段类型，获取表达式组件渲染属性
export const getExpressionRenderConfig = (column: Sheet.Column) => {
	switch (column?.columnType) {
		case Schema.CHECKBOX:
			return {
				type: LabelTypeMap.LabelCheckbox,
				props: {},
			}
		case Schema.DATE:
		case Schema.CREATE_AT:
		case Schema.UPDATE_AT:
			return {
				type: LabelTypeMap.LabelDateTime,
				props: {},
			}
		case Schema.MEMBER:
			return {
				type: LabelTypeMap.LabelMember,
				props: {
					options: [],
					value: [],
					onSearch: async (searchInfo: { with_department: number; name: string }) => {
						const searchedUsers = await ContactApi?.searchUser?.({
							query: searchInfo.name,
							page_token: "",
							// @ts-ignore
							query_type: 2,
						})
						if (searchedUsers?.items?.length) {
							const filterUsers = searchedUsers?.items?.filter(
								(user) => user.user_type !== UserType.AI,
							)
							const filterUserInfos = filterUsers.map((user) => {
								return {
									id: user.user_id,
									name: user.real_name || user.nickname,
									avatar: user.avatar_url,
								}
							})
							return filterUserInfos
						}
						return []
					},
				},
			}
		case Schema.SELECT:
			return {
				type: LabelTypeMap.LabelSelect,
				props: {
					value: [],
					options: column?.columnProps?.options,
				},
			}
		case Schema.MULTIPLE:
			return {
				type: LabelTypeMap.LabelMultiple,
				props: {
					value: [],
					options: column?.columnProps?.options,
				},
			}
		default:
			return undefined
	}
}

export const getPlaceholder = (
	column: Sheet.Column,
	columnType: Schema,
	isSpecialHandle?: boolean,
) => {
	switch (columnType) {
		case Schema.TEXT:
		case Schema.NUMBER:
		case Schema.LINK:
			return "请输入"
		case Schema.MEMBER:
		case Schema.CREATED:
		case Schema.UPDATED:
			return "选择成员"
		case Schema.QUOTE_RELATION:
		case Schema.MUTUAL_RELATION:
		case Schema.SELECT:
		case Schema.MULTIPLE:
			return "请选择"
		case Schema.DATE:
		case Schema.CREATE_AT:
		case Schema.UPDATE_AT:
		case Schema.TODO_FINISHED_AT:
			if (isSpecialHandle) return "YYYY-MM-DD"
			return get(column, ["columnProps", "format"], "YYYY-MM-DD")
		default:
			return ""
	}
}

// Create a case-insensitive highlight segmentation function
export const createHighlightSegments = (text: string, keyword: string) => {
	if (!keyword.trim() || !text.toLowerCase().includes(keyword.toLowerCase())) {
		return [
			{
				type: "normal",
				value: text,
			},
		]
	}

	const result = []
	let remainingText = text

	while (remainingText) {
		const match = remainingText.toLowerCase().indexOf(keyword.toLowerCase())

		if (match === -1) {
			// No more matches, add the rest as normal text
			if (remainingText) {
				result.push({
					type: "normal",
					value: remainingText,
				})
			}
			break
		}

		// Add text before match as normal
		if (match > 0) {
			result.push({
				type: "normal",
				value: remainingText.substring(0, match),
			})
		}

		// Add the matched text as highlight (preserve original case)
		result.push({
			type: "highlight",
			value: remainingText.substring(match, match + keyword.length),
		})

		// Continue with remaining text
		remainingText = remainingText.substring(match + keyword.length)
	}

	return result.filter((item) => item.value.length > 0)
}
