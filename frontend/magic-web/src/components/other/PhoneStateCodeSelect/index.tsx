import { useMemo } from "react"
import { useAreaCodes, useGlobalLanguage } from "@/models/config/hooks"
import MagicSelect, { type OptionType } from "@/components/base/MagicSelect"
import { cn } from "@/lib/utils"

interface PhoneStateCodeSelectProps {
	value: string
	onChange: (value: string) => void
	className?: string
	disabled?: boolean
	/** 移动端区号选择抽屉可能嵌在高层级 Sheet 内，允许调用方指定 Portal 层级。 */
	popupZIndex?: number
	dataTestId?: string
}

function PhoneStateCodeSelect({
	value,
	onChange,
	className,
	disabled,
	popupZIndex,
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
			popupZIndex={popupZIndex}
			dataTestId={dataTestId}
		/>
	)
}

export default PhoneStateCodeSelect
