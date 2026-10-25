import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"

export default function PPTTransitionDurationInput({
	value,
	disabled,
	onChange,
}: {
	value?: number
	disabled: boolean
	onChange: (milliseconds: number) => void
}) {
	const { t } = useTranslation("super")
	const [text, setText] = useState(value === undefined ? "" : String(value / 1000))
	useEffect(() => {
		setText(value === undefined ? "" : String(value / 1000))
	}, [value])
	return (
		<label className="flex items-center justify-between gap-3 text-sm">
			<span>{t("ppt.transitions.duration")}</span>
			<Input
				aria-label={t("ppt.transitions.duration")}
				className="w-28"
				type="number"
				min={0.1}
				max={2}
				step={0.05}
				value={text}
				placeholder={t("ppt.transitions.mixed")}
				disabled={disabled}
				onChange={(event) => {
					// Preserve intermediate input such as "0." while only publishing valid settings.
					setText(event.target.value)
					const milliseconds = Number(event.target.value) * 1000
					const rounded = Math.round(milliseconds)
					if (
						Math.abs(milliseconds - rounded) < 1e-7 &&
						rounded >= 100 &&
						rounded <= 2000 &&
						rounded % 50 === 0
					)
						onChange(rounded)
				}}
				onBlur={() => {
					setText(value === undefined ? "" : String(value / 1000))
				}}
			/>
		</label>
	)
}
