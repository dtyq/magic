import i18next from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"
import Select, { MultipleSelectProps } from "./Select"

const MultipleSelect = ({
	value,
	onChange,
	size,
	isMultiple = true,
	options,
}: MultipleSelectProps) => {
	const { t } = useTranslation()
	return (
		<Select
			value={value}
			options={options}
			onChange={onChange}
			isMultiple={isMultiple}
			filterOption={false}
			size={size}
			placeholder={i18next.t("common.pleaseSelect", { ns: "magicFlow" })}
		/>
	)
}

export default MultipleSelect
