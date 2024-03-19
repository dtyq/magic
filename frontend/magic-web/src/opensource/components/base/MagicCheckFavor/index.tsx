import { useCallback, useMemo, useState } from "react"

type Props = {
	onChange?: (checked: boolean) => void
	checked?: boolean
}
const genRandomId = () => {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}
export default function MagicCheckFavor({ checked, onChange }: Props) {
	const checkId = useMemo(() => genRandomId(), [])
	const [checkedComp, setCheckedComp] = useState(checked)

	const handleChange = useCallback(
		(changeValue: boolean) => {
			if (onChange) {
				onChange(changeValue)
			}
		},
		[onChange],
	)
	return (
		<div className="relative h-4 w-4">
			<input
				className="peer sr-only"
				onChange={(e) => {
					setCheckedComp(e.target.checked)
					handleChange(e.target.checked)
				}}
				checked={checkedComp}
				type="checkbox"
				id={`checkBoxInput_${checkId}`}
			/>
			<label
				className="absolute inset-0 cursor-pointer rounded border border-[#c2c2c2] bg-white after:absolute after:left-[3px] after:top-[48%] after:h-[2px] after:w-2 after:border-2 after:border-l-0 after:border-r-0 after:border-t-0 after:border-white after:opacity-0 after:content-[''] peer-checked:bg-[rgba(49,92,236,1)] peer-checked:after:opacity-100"
				htmlFor={`checkBoxInput_${checkId}`}
			/>
		</div>
	)
}
