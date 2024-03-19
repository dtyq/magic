import SearchInput from "@/common/BaseUI/DropdownRenderer/SearchInput"
import { InputRef } from "antd"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Multiple } from "../types"
import { MultipleSelectProps } from "./Select"
import MultipleItem from "./components/MultipleItem/MultipleItem"
import "./styles/options.less"

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
	value: MultipleSelectProps["value"]
	itemClick: (val: Multiple) => void
} & Pick<MultipleSelectProps, "options" | "filterOption">

const SelectOptions = forwardRef<SelectOptionRef, SelectOptionsProps>((props, ref) => {
	const { t } = useTranslation()
	const { value, options, itemClick, filterOption = false } = props
	const [inputValue, setInputValue] = useState("")
	const timer = useRef<any>()
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

		if (timer.current) clearTimeout(timer.current)
		const value = _.trim(val)
		timer.current = setTimeout(() => {
			const filterOptions = copyOptions.filter((item) => item.label.indexOf(value) > -1)
			setDisplayOptions(filterOptions)

			// TODO 当不存在多选项需要支持新增用户输入的项
			// if (filterOptions.length) {
			// 	const existEqualOption = filterOptions.some(item => item.label === value)
			// 	setShowAddOptionBtn(!existEqualOption && !!value)
			// } else {
			// 	setShowAddOptionBtn(!!value)
			// }
		}, 100)
	})

	const onPressEnter = useMemoizedFn(() => {
		if (!inputValue.length) return
		const filterOptions = displayOptions.filter((item) => item.label === inputValue)
		if (filterOptions.length) {
			itemClick(filterOptions[0].id as string)
			setInputValue("")
		}
		// if (!isEnableAdd) return
		// addOption()
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
		<div className="magic-multiple-options" onWheel={(e) => e.stopPropagation()}>
			<ul
				className="ul"
				onContextMenu={(e) => e.preventDefault()}
				onClick={(e) => e.stopPropagation()}
			>
				<li className="search bb1">
					<SearchInput
						placeholder={i18next.t("common.searchConstants", { ns: "magicFlow" })}
						value={inputValue}
						onChange={onChange}
						onPressEnter={onPressEnter}
					/>
				</li>
				<div className="container nowheel">
					{displayOptions.map((item) => {
						return (
							<MultipleItem
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
