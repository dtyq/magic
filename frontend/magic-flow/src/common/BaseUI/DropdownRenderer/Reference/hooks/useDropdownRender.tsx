import { useDebounceFn, useMemoizedFn, useMount, useUpdateEffect } from "ahooks"
import React, { useMemo, useState } from "react"
import { DataSourceOption } from ".."
import { getDefaultExpandedKeys, getRelationDataSource, getRelationExpandKeys } from "../helpers"

type DropdownRenderProps = {
	dataSource: DataSourceOption[]
	userInput: string[]
}

export default function useDropdownRender({ dataSource, userInput }: DropdownRenderProps) {
	// 经过过滤后的数据源
	const [filterDataSource, setFilterDataSource] = useState(dataSource)
	const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
	const [autoExpandParent, setAutoExpandParent] = useState(true)
	// 搜索关键词
	const [keyword, setKeyword] = useState("")

	const onExpand = useMemoizedFn((newExpandedKeys: React.Key[]) => {
		setExpandedKeys(newExpandedKeys)
		setAutoExpandParent(false)
	})

	useUpdateEffect(() => {
		setFilterDataSource(getRelationDataSource(dataSource, keyword))
	}, [keyword, dataSource])

	const allExpandKeys = useMemo(() => {
		return getDefaultExpandedKeys(filterDataSource)
	}, [filterDataSource])

	useMount(() => {
		setExpandedKeys(allExpandKeys)
	})

	useUpdateEffect(() => {
		setExpandedKeys(allExpandKeys)
	}, [userInput])

	// 防抖计算
	const { run: updateExpandKeysByKeyword } = useDebounceFn(
		(value: string) => {
			const newExpandedKeys = getRelationExpandKeys(filterDataSource, value)
			// console.log("newExpandedKeys", dataSource, value, newExpandedKeys)
			setExpandedKeys(newExpandedKeys)
		},
		{
			wait: 500,
		},
	)

	// 搜索关键字变化处理
	const onSearchChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		const { value } = e.target
		updateExpandKeysByKeyword(value)
		setKeyword(value)
		setAutoExpandParent(true)
		setExpandedKeys(allExpandKeys)
	})

	return {
		keyword,
		setKeyword,
		onSearchChange,
		onExpand,
		expandedKeys,
		autoExpandParent,
		filterDataSource,
	}
}
