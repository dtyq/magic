/**
 * 通用型dropdown Renderer
 */
import { DefaultOptionType } from "antd/lib/select"
import { IconCheck } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React from "react"
import SearchInput from "../SearchInput"
import { RendererWrapper } from "./style"
import useBaseDropdownRenderer from "./useBaseDropdownRenderer"

export type BaseDropdownOption = DefaultOptionType & { realLabel?: string; [key: string]: any }

type BaseDropdownRenderer = {
	options: BaseDropdownOption[]
	placeholder?: string
	onChange?: (value: DefaultOptionType["value"] | any[]) => void
	value?: DefaultOptionType["value"] | any[]
	showSearch?: boolean
	selectRef?: any
	multiple?: boolean
	OptionWrapper?: React.FC<any>
}

export default function BaseDropdownRenderer({
	options,
	placeholder,
	onChange,
	value,
	showSearch = true,
	multiple,
	OptionWrapper = ({ children, tool }) => <>{children}</>,
	selectRef,
}: BaseDropdownRenderer) {
	const { keyword, onSearchChange, filterOptions } = useBaseDropdownRenderer({
		options,
		showSearch,
	})

	const onSelectItem = useMemoizedFn((val: any) => {
		const cloneValue = _.castArray(value).filter((v) => !!v)
		/** 处理多选 */
		if (multiple) {
			if (cloneValue?.includes?.(val)) {
				return
			} else {
				onChange?.([...cloneValue, val])
			}
			return
		}
		/** 处理单选 */
		onChange?.(val)
	})

	return (
		<RendererWrapper onClick={(e) => e.stopPropagation()}>
			{showSearch && (
				<div className="search-wrapper">
					<SearchInput
						placeholder={placeholder}
						value={keyword}
						onChange={onSearchChange}
					/>
				</div>
			)}
			<div className="dropdown-list">
				{filterOptions.map((option) => {
					return (
						<OptionWrapper tool={option}>
							<div
								className="dropdown-item"
								onClick={() => {
									onSelectItem(option.value)
								}}
							>
								<div className="label">{option.label}</div>
								{value === option.value && <IconCheck className="tick" />}
							</div>
						</OptionWrapper>
					)
				})}
			</div>
		</RendererWrapper>
	)
}
