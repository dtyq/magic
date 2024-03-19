import SearchInput from "@/common/BaseUI/DropdownRenderer/SearchInput"
import { InputRef } from "antd"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Member } from "../types"
import { MemberSelectProps } from "./Select"
import MemberItem from "./components/MemberItem/MemberItem"
import "./styles/options.less"
import { Timeout } from "ahooks/lib/useRequest/src/types"

/**
 *
 * @param {Function} itemClick 点击单个选择调用事件
 * @param {Ref} parent 父级Ref主要用来获取输入框的高度，然后将下拉弹层向下移
 * @param {Array} values 值
 * @param {Array} options 下拉选项
 * @param {Boolean || Function} filterOption 是否允许过滤
 * @param {Function} onSearch 搜索函数
 * @param {Component} footer 组件
 * @param {Object} extraOptions // 选择上一步的配置
 * {
 *		showExtra, //是否显示选择上一步
 * 		step, // 当前是第几步
 * 		fieldTypes // 支持的字段类型
 * }
 */

type SelectOptionRef = {
	inputRef: React.RefObject<InputRef>
	onChange: (e: any) => void
	setInputValue: React.Dispatch<React.SetStateAction<string>>
}

type SelectOptionsProps = {
	value: MemberSelectProps["value"]
	onlyMyself?: boolean
	itemClick: (val: Member) => void
} & Pick<MemberSelectProps, "options" | "filterOption" | "onSearch">

const SelectOptions = forwardRef<SelectOptionRef, SelectOptionsProps>((props, ref) => {
	const { t } = useTranslation()
	const {
		value,
		options,
		itemClick,
		filterOption = false,
		onSearch = () => {},
		onlyMyself = false,
	} = props
	const [inputValue, setInputValue] = useState("")
	const timer = useRef<Timeout>()
	const [displayOptions, setDisplayOptions] = useState(options || [])
	const inputRef = useRef<InputRef>(null)

	const copyOptions = useMemo(() => {
		return [...(options || [])]
	}, [options])

	useEffect(() => {
		setDisplayOptions(options)
	}, [options])

	const onChange = useMemoizedFn((e) => {
		const val = e.target.value
		setInputValue(val)

		typeof onSearch === "function" && onSearch(val)

		if (timer.current) clearTimeout(timer.current)
		const value = _.trim(val)
		timer.current = setTimeout(() => {
			if (!filterOption) return

			let tmpOptions = [] as Member[]
			if (filterOption && typeof filterOption === "boolean")
				tmpOptions = copyOptions.filter(
					(item) => (item.name || item.real_name).indexOf(value) > -1,
				)
			else if (filterOption && typeof filterOption === "function")
				tmpOptions = filterOption(val, copyOptions)
			setDisplayOptions(tmpOptions)
		}, 100)
	})

	const onPressEnter = useMemoizedFn(() => {
		if (!inputValue.length) return
		const filterOptions = displayOptions.filter((item) => item.name === inputValue)
		if (filterOptions.length) {
			itemClick(filterOptions[0])
			setInputValue("")
		}
	})

	useImperativeHandle(
		ref,
		() => ({
			inputRef,
			onChange,
			setInputValue,
		}),
		[onChange, setInputValue],
	)

	return (
		<div className="magic-member-options" onWheel={(e) => e.stopPropagation()}>
			<ul
				className="ul"
				onContextMenu={(e) => e.preventDefault()}
				onClick={(e) => e.stopPropagation()}
			>
				{!onlyMyself && (
					<li className="search bb1">
						<SearchInput
							placeholder={i18next.t("common.searchConstants", { ns: "magicFlow" })}
							value={inputValue}
							onChange={onChange}
							onPressEnter={(e: any) => {
								onPressEnter()
								e.stopPropagation()
								e.preventDefault()
							}}
						/>
					</li>
				)}
				<div className="container nowheel">
					{displayOptions.map((item) => {
						return (
							<MemberItem
								key={item.id}
								item={item}
								value={value}
								itemClick={itemClick}
							/>
						)
					})}
					{!displayOptions.length && (
						<li className="empty">
							{i18next.t("common.searchNone", { ns: "magicFlow" })}
						</li>
					)}
				</div>
			</ul>
		</div>
	)
})

export default SelectOptions
