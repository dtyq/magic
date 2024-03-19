import { ExpressionSource, LabelTypeMap } from "@/MagicExpressionWidget/types"
import { TreeDataNode } from "antd"
import _ from "lodash"
import React from "react"
import { Splitor } from "./constants"

// 设置所有节点的 key 到 expandedKeys 中
export const getDefaultExpandedKeys = (data: TreeDataNode[]) => {
	const keys = [] as React.Key[]
	data.forEach((item) => {
		// 对函数块特殊处理，默认折叠
		if ((item.key as string)?.includes?.(LabelTypeMap.LabelFunc)) return
		if (item.children) {
			keys.push(item.key)
			keys.push(...getDefaultExpandedKeys(item.children))
		}
	})
	return keys
}

// [parentKey, childKey] => ['parentKey_childKey']
const getJoinedParentKeys = (keys: React.Key[]) => {
	return keys.reduce((acc, key) => {
		if (acc.length === 0) {
			acc.push(`${key}`)
			return acc
		}
		const lastKey = acc[acc.length - 1]
		acc.push(`${lastKey}${Splitor}${key}`)
		return acc
	}, [] as string[])
}

// 获取所有与关键字相关的expandKeys
export const getRelationExpandKeys = (
	data: TreeDataNode[],
	searchKeyword: string,
	parentKeys = [] as string[],
) => {
	const keys = [] as React.Key[]

	data.forEach((item) => {
		if ((item.title as string).includes(searchKeyword)) {
			keys.push(...(parentKeys || ([] as React.Key[])))
			keys.push(item.key)
		}
		if (item.children) {
			keys.push(
				...getRelationExpandKeys(item.children, searchKeyword, [
					...parentKeys,
					item.key as string,
				]),
			)
		}
	})

	const uniqKeys = [...new Set(keys)]

	return uniqKeys
}

// 获取所有与用户输入相关的数据源
export const getRelationDataSource = (dataSource: ExpressionSource, title: string) => {
	const relationDataSource = [] as ExpressionSource
	const cloneDataSource = _.cloneDeep(dataSource)

	cloneDataSource.forEach((item) => {
		// console.log(title, item)
		if ((item.title as string).includes(title) || item?.children?.length) {
			let children = item.children
			if (children?.length) {
				children = getRelationDataSource(children, title)
			}
			relationDataSource.push({ ...item, children })
		}
	})

	return relationDataSource
}
