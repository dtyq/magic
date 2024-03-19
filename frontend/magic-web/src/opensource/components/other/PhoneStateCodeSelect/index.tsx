import { useMemo } from "react"
import { useAreaCodes, useGlobalLanguage } from "@/opensource/models/config/hooks"
import MagicSelect, { type OptionType } from "@/opensource/components/base/MagicSelect"
import { cn } from "@/opensource/lib/utils"

interface PhoneStateCodeSelectProps {
	value: string
	onChange: (value: string) => void
	className?: string
	disabled?: boolean
	dataTestId?: string
}

function PhoneStateCodeSelect({
	value,
	onChange,
	className,
	disabled,
	dataTestId,
}: PhoneStateCodeSelectProps) {
	const { areaCodes } = useAreaCodes()
	const language = useGlobalLanguage(false)

	const phoneOptions = useMemo<OptionType[]>(() => {
		return areaCodes.map((item): OptionType => {
			return {
				value: item.code,
				label: item.translations?.[language] || item.name,
				desc: item.name,
				dataTestId: `phone-state-code-option-${item.code}`,
			}
		})
	}, [areaCodes, language])

	return (
		<MagicSelect
			options={phoneOptions}
			defaultValue="+86"
			value={value}
			onChange={onChange}
			className={cn("h-9 rounded-md border border-input bg-white", className)}
			style={{ width: "75px" }}
			styles={{
				popup: {
					root: { minWidth: "fit-content" },
				},
			}}
			onClick={(e) => e.stopPropagation()}
			labelRender={(option) => <div className="text-sm">{option.value}</div>}
			optionRender={(option) => (
				<div key={option.value} className="text-sm">
					{option.label} ({option.value})
				</div>
			)}
			popupMatchSelectWidth={false}
			disabled={disabled}
			dataTestId={dataTestId}
		/>
	)
}

export default PhoneStateCodeSelect
