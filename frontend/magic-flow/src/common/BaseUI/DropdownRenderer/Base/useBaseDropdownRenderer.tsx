import { useMemoizedFn } from "ahooks"
import React, { useMemo, useState } from "react"
import { BaseDropdownOption } from "."

type DropdownRenderProps = {
	options: BaseDropdownOption[]
	showSearch: boolean
}

export default function useBaseDropdownRenderer({ options, showSearch }: DropdownRenderProps) {
	// 搜索关键词
	const [keyword, setKeyword] = useState("")

	// 搜索关键字变化处理
	const onSearchChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		const { value } = e.target
		setKeyword(value)
	})

	const filterOptions = useMemo(() => {
		// 不需要支持搜索，直接返回全部
		if (!showSearch) return options
		return options.filter((option) => {
			//@ts-ignore
			return option?.realLabel?.includes(keyword)
		})
	}, [options, keyword])

	return {
		keyword,
		setKeyword,
		onSearchChange,
		filterOptions,
	}
}
