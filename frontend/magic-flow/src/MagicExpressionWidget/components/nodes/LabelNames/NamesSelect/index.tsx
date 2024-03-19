import i18next from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"
import Select, { NamesSelectProps } from "./Select"

const NamesSelect = ({
	value,
	onChange,
	size,
	isMultiple = true,
	options,
	...props
}: NamesSelectProps) => {
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
			{...props}
		/>
	)
}

export default NamesSelect
