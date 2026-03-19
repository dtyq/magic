import type { SelectProps } from "antd/lib/select"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import type React from "react"
import { useState } from "react"

interface TagsSelectProps extends SelectProps {
	onChange: (value: string[]) => void
	value: string[]
}

const TagsSelect = ({ ...props }: TagsSelectProps) => {
	const [inputValue, setInputValue] = useState<string>("")

	const handleInputChange = (value: string) => {
		setInputValue(value)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Tab") {
			e.preventDefault() // 阻止默认的 tab 键行为

			// 检查是否已经存在相同的值
			if (!props?.value?.includes(inputValue.trim()) && inputValue.trim() !== "") {
				// eslint-disable-next-line no-unsafe-optional-chaining
				props?.onChange([...props?.value, inputValue.trim()])
				setInputValue("")
			}
		}
	}

	return (
		<MagicSelect
			style={{ width: "100%" }}
			mode="tags"
			multiple
			searchValue={inputValue}
			open={false}
			onInputKeyDown={handleKeyDown}
			onInput={(e: any) => handleInputChange(e.target.value)}
			{...props}
		/>
	)
}

export default TagsSelect
