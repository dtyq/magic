import { type SelectProps } from "antd"
import { useMemo } from "react"
import { MagicSelect } from "components"
import { useTranslation } from "react-i18next"
import { useAdmin } from "@/provider/AdminProvider"
import type { AreaCodeOption } from "@/provider/AdminProvider/types"

function PhoneStateCodeSelect({ value, onChange, ...props }: SelectProps) {
	const { areaCodes } = useAdmin()
	const { i18n } = useTranslation()

	const { language } = i18n

	const phoneOptions = useMemo(() => {
		return areaCodes?.map((item: AreaCodeOption) => {
			return {
				value: item.code,
				label: item.translations?.[language] || item.name,
				desc: item.name,
			}
		})
	}, [areaCodes, language])

	return (
		<MagicSelect
			options={phoneOptions}
			defaultValue="+86"
			value={value}
			onChange={onChange}
			style={{ width: "75px", border: "none" }}
			styles={{
				popup: {
					root: { minWidth: "fit-content" },
				},
			}}
			onClick={(e) => e.stopPropagation()}
			labelRender={(option) => <div>{option.value}</div>}
			optionRender={(option) => (
				<div key={option.value}>
					{option.label} ({option.value})
				</div>
			)}
			popupMatchSelectWidth={false}
			{...props}
		/>
	)
}

export default PhoneStateCodeSelect
