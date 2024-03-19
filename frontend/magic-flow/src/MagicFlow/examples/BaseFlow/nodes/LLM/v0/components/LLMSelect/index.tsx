import TsSelect from "@/common/BaseUI/Select"
import { SelectProps } from "antd"
import { IconAdjustmentsHorizontal, IconChevronDown } from "@tabler/icons-react"
import clsx from "clsx"
import React, { useMemo } from "react"
import LLMLabel, { LLMLabelTagType } from "./LLMLabel"
import styles from "./index.module.less"

export type LLMOption = {
	value: string
	label: string
	tags: {
		type: LLMLabelTagType
		value: string
	}[]
}

interface LLMSelect extends SelectProps {
	value: string | number | boolean | null | undefined
	onChange?: (val: string | number | boolean | null | undefined) => void
	options: LLMOption[]
	className?: string
	dropdownRenderProps?: object
	placeholder?: string
	showLLMSuffixIcon?: boolean
}

export default function LLMSelect({
	value,
	onChange,
	options,
	className,
	dropdownRenderProps,
	showLLMSuffixIcon,
	...props
}: LLMSelect) {
	const showOptions = useMemo(() => {
		return options.map((option) => {
			return {
				...option,
				label: (
					<LLMLabel
						label={option.label}
						tags={option.tags}
						value={option.value}
						selectedValue={value}
						showCheck={false}
					/>
				),
				realLabel: option.label,
			}
		})
	}, [options, value])

	return (
		<TsSelect
			{...props}
			className={clsx(styles.LLMSelect, className)}
			options={showOptions}
			value={value}
			onChange={onChange}
			dropdownRenderProps={
				dropdownRenderProps
					? dropdownRenderProps
					: {
							placeholder: "搜索模型",
					  }
			}
			suffixIcon={
				showLLMSuffixIcon ? (
					<div className={styles.suffixIcon}>
						<IconAdjustmentsHorizontal color="#1C1D23" />
						<IconChevronDown />
					</div>
				) : null
			}
		></TsSelect>
	)
}
